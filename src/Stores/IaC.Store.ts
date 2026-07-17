import { Instance, flow, getRoot, types } from "mobx-state-tree";
import { BaseStore } from "./Base.Store";
import authStore from "./Auth.Store";
import api from "../lib/api";
import { IaCPackageModel, IIaCPackage } from "./Models/IaCPackage.Model";
import { IaCTemplateDetailModel } from "./Models/IaCTemplateDetail.Model";
import {
	IaCTemplateListItemModel,
	IIaCTemplateListItem,
} from "./Models/IaCTemplateListItem.Model";
import { parseIacTemplateXml, validateIacTemplateXml } from "../lib/iacTemplateXml";
import {
	createRestLoadFailureReport,
	enrichRestLoadReport,
	loadRestArrayIntoStore,
	publishRestLoadReport,
	RestLoadErrorEntry,
} from "../lib/restSnapshot";
import { buildRestUrl } from "../lib/restUrlCatalog";
import { iacTemplateWriteKey, iacWriteErrorRegistry } from "../lib/iacWriteActivity";
import { RestRequestError } from "../lib/api";
import {
	iacTemplateSelectionKey,
	parseIacTemplateSelectionKey,
} from "../lib/iacTemplateKeys";
import { downloadTextAsFile } from "../lib/downloadTextAsFile";
import { iacTemplateRunUri } from "../lib/iacRestUris";
import { IRootStore } from "./Root.Store";
import config from "../lib/config";

export type IaCTemplateMetaSnapshot = {
	version: string;
	format: string;
	filename: string;
	mimeType: string;
};

function iacListItemId(item: unknown): string {
	if (item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string") {
		return (item as { name: string }).name;
	}
	return "unknown";
}

function isEditable(self: unknown): boolean {
	return !getRoot<IRootStore>(self as object).ui.isReadOnly;
}

function restFailureFromError(
	error: unknown,
	requestMeta: { method: string; path: string; fullUrl: string },
	packageName: string,
	templateName: string,
	payload?: string
) {
	const message = error instanceof Error ? error.message : "Anfrage fehlgeschlagen.";
	return {
		templateKey: iacTemplateWriteKey(packageName, templateName),
		packageName,
		templateName,
		method: requestMeta.method,
		path: requestMeta.path,
		fullUrl: requestMeta.fullUrl,
		message,
		payload,
		...(error instanceof RestRequestError
			? {
				status: error.status,
				statusText: error.statusText,
				responseBody: error.responseBody,
				responseHeaders: error.responseHeaders,
			}
			: {}),
	};
}

export const IaCStore = types
	.compose(
		"IaCStore",
		BaseStore,
		types.model({
			packages: types.array(IaCPackageModel),
			templatesByPackage: types.map(types.array(IaCTemplateListItemModel)),
			selectedPackageName: types.maybeNull(types.string),
			selectedTemplateName: types.maybeNull(types.string),
			selectedTemplateVersion: types.maybeNull(types.string),
			selectedTemplateKeys: types.array(types.string),
			templateMetaByKey: types.map(types.frozen<IaCTemplateMetaSnapshot>()),
			templateXmlCacheByKey: types.map(types.string),
			templateDetail: types.maybeNull(IaCTemplateDetailModel),
			templateDetailLoadState: types.optional(
				types.enumeration(["idle", "loading", "loaded", "error"]),
				"idle"
			),
			templateDetailError: types.maybeNull(types.string),
			templateEditXml: types.maybeNull(types.string),
			templateEditBaselineXml: types.maybeNull(types.string),
			templateEditDirty: types.optional(types.boolean, false),
			templateSaveState: types.optional(
				types.enumeration(["idle", "saving", "saved", "error"]),
				"idle"
			),
			templateSaveError: types.maybeNull(types.string),
			templateRunResult: types.maybeNull(types.string),
			templateRunState: types.optional(
				types.enumeration(["idle", "loading", "loaded", "error"]),
				"idle"
			),
			templateRunError: types.maybeNull(types.string),
		})
	)
	.views((self) => ({
		get activePackage(): IIaCPackage | undefined {
			if (!self.selectedPackageName) {
				return undefined;
			}
			return self.packages.find((pkg) => pkg.name === self.selectedPackageName);
		},
		hasTemplatesLoaded(packageName: string): boolean {
			return self.templatesByPackage.has(packageName);
		},
		getTemplatesForPackage(packageName: string): IIaCTemplateListItem[] {
			return self.templatesByPackage.get(packageName)?.slice() ?? [];
		},
		findTemplateByName(
			packageName: string,
			templateName: string
		): IIaCTemplateListItem | undefined {
			return self.templatesByPackage
				.get(packageName)
				?.find((template) => template.name === templateName);
		},
		getTemplateMeta(packageName: string, templateName: string): IaCTemplateMetaSnapshot | undefined {
			return self.templateMetaByKey.get(iacTemplateSelectionKey(packageName, templateName));
		},
		get templateEditValidationError(): string | null {
			if (self.templateEditXml == null || self.templateEditXml === "") {
				return "Template-XML ist leer.";
			}
			const validation = validateIacTemplateXml(self.templateEditXml);
			return validation.ok ? null : validation.message;
		},
		get resolvedTemplateVersion(): string | null {
			return self.selectedTemplateVersion;
		},
	}))
	.actions((self) => {
		function cacheTemplate(packageName: string, templateName: string, xmlText: string) {
			const key = iacTemplateSelectionKey(packageName, templateName);
			self.templateXmlCacheByKey.set(key, xmlText);
			try {
				const parsed = parseIacTemplateXml(xmlText);
				self.templateMetaByKey.set(key, {
					version: parsed.version,
					format: parsed.format,
					filename: parsed.filename,
					mimeType: parsed.mimeType,
				});
			} catch {
				// Metadata parse errors surface on explicit template load
			}
		}

		function removeTemplateFromCaches(packageName: string, templateName: string) {
			const key = iacTemplateSelectionKey(packageName, templateName);
			self.templateMetaByKey.delete(key);
			self.templateXmlCacheByKey.delete(key);
			self.selectedTemplateKeys.replace(
				self.selectedTemplateKeys.filter((entry) => entry !== key)
			);
			if (
				self.selectedPackageName === packageName &&
				self.selectedTemplateName === templateName
			) {
				self.selectedPackageName = null;
				self.selectedTemplateName = null;
				self.selectedTemplateVersion = null;
				resetEditorState();
			}
		}

		function resetEditorState() {
			self.templateDetail = null;
			self.templateDetailLoadState = "idle";
			self.templateDetailError = null;
			self.templateEditXml = null;
			self.templateEditBaselineXml = null;
			self.templateEditDirty = false;
			self.templateSaveState = "idle";
			self.templateSaveError = null;
			self.templateRunResult = null;
			self.templateRunState = "idle";
			self.templateRunError = null;
		}

		function setTemplateEditXml(xml: string) {
			if (!isEditable(self)) {
				return;
			}
			self.templateEditXml = xml;
			self.templateEditDirty = xml !== (self.templateEditBaselineXml ?? "");
			if (self.templateEditDirty) {
				self.templateSaveState = "idle";
			}
		}

		function discardTemplateEdit() {
			if (!isEditable(self)) {
				return;
			}
			self.templateEditXml = self.templateEditBaselineXml;
			self.templateEditDirty = false;
			self.templateSaveState = "idle";
			self.templateSaveError = null;
			iacWriteErrorRegistry.clear();
		}

		function setSelectedTemplateKeys(keys: string[]) {
			self.selectedTemplateKeys.replace(keys);
		}

		function setSelectedTemplateVersion(version: string | null) {
			self.selectedTemplateVersion = version;
		}

		const loadPackages = flow(function* loadPackages(domainFromRoute?: string) {
			const domain = domainFromRoute ?? authStore.getDomain();
			if (!domain) {
				publishRestLoadReport(
					createRestLoadFailureReport("IaCPackage", new Error("Keine Domain für IaC-Laden gesetzt."), {
						domain,
					})
				);
				return;
			}

			try {
				const jsonData: unknown = yield api.getIacPackages(domain);
				const report = enrichRestLoadReport(
					loadRestArrayIntoStore(self.packages, IaCPackageModel, jsonData, "IaCPackage", {
						domain,
						getItemId: iacListItemId,
					}),
					"IaCPackage",
					domain
				);
				publishRestLoadReport(report);
			} catch (error) {
				publishRestLoadReport(createRestLoadFailureReport("IaCPackage", error, { domain }));
			}
		});

		const loadTemplatesForPackage = flow(function* loadTemplatesForPackage(
			packageName: string,
			domainFromRoute?: string,
			forceReload = false
		) {
			const domain = domainFromRoute ?? authStore.getDomain();
			if (!domain) {
				publishRestLoadReport(
					createRestLoadFailureReport("IaCTemplate", new Error("Keine Domain für IaC-Laden gesetzt."), {
						domain,
						restUrlIds: { packageName },
					})
				);
				return;
			}

			if (self.templatesByPackage.has(packageName) && !forceReload) {
				return;
			}

			if (forceReload) {
				self.templatesByPackage.set(packageName, []);
			} else if (!self.templatesByPackage.has(packageName)) {
				self.templatesByPackage.set(packageName, []);
			}

			try {
				const jsonData: unknown = yield api.getIacTemplates(domain, packageName);
				const target = self.templatesByPackage.get(packageName)!;
				const report = enrichRestLoadReport(
					loadRestArrayIntoStore(target, IaCTemplateListItemModel, jsonData, "IaCTemplate", {
						domain,
						restUrlIds: { packageName },
						getItemId: iacListItemId,
					}),
					"IaCTemplate",
					domain,
					{ packageName }
				);
				publishRestLoadReport(report);
			} catch (error) {
				publishRestLoadReport(
					createRestLoadFailureReport("IaCTemplate", error, {
						domain,
						restUrlIds: { packageName },
					})
				);
			}
		});

		const selectTemplate = flow(function* selectTemplate(
			packageName: string,
			templateName: string,
			domainFromRoute?: string,
			version: string | null = null
		) {
			self.selectedPackageName = packageName;
			self.selectedTemplateName = templateName;
			self.selectedTemplateVersion = version;
			resetEditorState();
			yield loadTemplatesForPackage(packageName, domainFromRoute);
			yield loadTemplate(packageName, templateName, domainFromRoute);
		});

		const loadTemplate = flow(function* loadTemplate(
			packageName: string,
			templateName: string,
			domainFromRoute?: string
		) {
			const domain = domainFromRoute ?? authStore.getDomain();
			if (!domain) {
				publishRestLoadReport(
					createRestLoadFailureReport("IaCTemplate", new Error("Keine Domain für IaC-Laden gesetzt."), {
						domain,
						restUrlIds: { packageName, templateName, itemId: templateName },
					})
				);
				return;
			}

			const version = self.selectedTemplateVersion;
			const requestMeta = buildRestUrl(domain, "IaCTemplate", "get", {
				packageName,
				templateName,
				itemId: templateName,
				templateVersion: version,
			});

			self.selectedPackageName = packageName;
			self.selectedTemplateName = templateName;
			self.templateDetailLoadState = "loading";
			self.templateDetail = null;
			self.templateDetailError = null;

			try {
				const xmlText: string = yield api.getIacTemplate(
					domain,
					packageName,
					templateName,
					version
				);
				if (
					self.selectedTemplateName !== templateName ||
					self.selectedPackageName !== packageName
				) {
					return;
				}

				self.templateEditXml = xmlText;
				self.templateEditBaselineXml = xmlText;
				self.templateEditDirty = false;
				cacheTemplate(packageName, templateName, xmlText);

				const errors: RestLoadErrorEntry[] = [];

				try {
					const parsed = parseIacTemplateXml(xmlText);
					self.templateDetail = IaCTemplateDetailModel.create(parsed);
					self.templateDetailLoadState = "loaded";
					self.templateDetailError = null;
					publishRestLoadReport({
						objectKind: "IaCTemplate",
						domain,
						responseFormat: "iac-template-xml",
						restCount: 1,
						loadedCount: 1,
						restIds: [templateName],
						loadedIds: [self.templateDetail.id],
						errors: [],
						loadedAt: new Date().toISOString(),
						request: {
							method: requestMeta.method,
							path: requestMeta.path,
							fullUrl: requestMeta.fullUrl,
							httpStatus: 200,
							responseBody: xmlText,
						},
					});
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					errors.push({
						objectKind: "IaCTemplate",
						itemId: templateName,
						message,
						responseBody: xmlText,
					});
					self.templateDetail = null;
					self.templateDetailLoadState = "error";
					self.templateDetailError = message;
					publishRestLoadReport({
						objectKind: "IaCTemplate",
						domain,
						responseFormat: "iac-template-xml",
						restCount: 1,
						loadedCount: 0,
						restIds: [templateName],
						loadedIds: [],
						errors,
						loadedAt: new Date().toISOString(),
						request: {
							method: requestMeta.method,
							path: requestMeta.path,
							fullUrl: requestMeta.fullUrl,
							httpStatus: 200,
							responseBody: xmlText,
						},
					});
				}
			} catch (error) {
				if (self.selectedTemplateName !== templateName) {
					return;
				}
				const message =
					error instanceof Error ? error.message : "Template konnte nicht geladen werden.";
				self.templateDetail = null;
				self.templateDetailLoadState = "error";
				self.templateDetailError = message;
				self.templateEditXml = null;
				self.templateEditBaselineXml = null;
				publishRestLoadReport(
					createRestLoadFailureReport("IaCTemplate", error, {
						domain,
						restUrlIds: {
							packageName,
							templateName,
							itemId: templateName,
							templateVersion: version,
						},
					})
				);
			}
		});

		const reloadSelectedTemplateVersion = flow(function* reloadSelectedTemplateVersion(
			version: string | null,
			domainFromRoute?: string
		) {
			const packageName = self.selectedPackageName;
			const templateName = self.selectedTemplateName;
			if (!packageName || !templateName) {
				return;
			}
			self.selectedTemplateVersion = version;
			resetEditorState();
			yield loadTemplate(packageName, templateName, domainFromRoute);
		});

		const saveTemplate = flow(function* saveTemplate(domainFromRoute?: string) {
			if (!isEditable(self)) {
				return;
			}

			const packageName = self.selectedPackageName;
			const templateName = self.selectedTemplateName;
			const xml = self.templateEditXml;
			const domain = domainFromRoute ?? authStore.getDomain();

			if (!domain || !packageName || !templateName || xml == null) {
				return;
			}

			const validation = validateIacTemplateXml(xml);
			if (!validation.ok) {
				self.templateSaveState = "error";
				self.templateSaveError = validation.message;
				return;
			}

			const requestMeta = buildRestUrl(domain, "IaCTemplate", "update", {
				packageName,
				templateName,
				itemId: templateName,
				templateVersion: self.selectedTemplateVersion,
			});

			self.templateSaveState = "saving";
			self.templateSaveError = null;
			iacWriteErrorRegistry.clear();

			try {
				yield api.putIacTemplate(
					domain,
					packageName,
					templateName,
					xml,
					self.selectedTemplateVersion
				);
				if (self.selectedTemplateName !== templateName) {
					return;
				}
				self.templateEditBaselineXml = xml;
				self.templateEditDirty = false;
				self.templateSaveState = "saved";
				cacheTemplate(packageName, templateName, xml);
				try {
					const parsed = parseIacTemplateXml(xml);
					self.templateDetail = IaCTemplateDetailModel.create(parsed);
					self.templateDetailLoadState = "loaded";
				} catch {
					// XML saved; parse for metadata optional
				}
			} catch (error) {
				if (self.selectedTemplateName !== templateName) {
					return;
				}
				const message = error instanceof Error ? error.message : "Speichern fehlgeschlagen.";
				self.templateSaveState = "error";
				self.templateSaveError = message;
				iacWriteErrorRegistry.setFailure(
					restFailureFromError(error, requestMeta, packageName, templateName, xml)
				);
			}
		});

		const runTemplate = flow(function* runTemplate(domainFromRoute?: string) {
			const packageName = self.selectedPackageName;
			const templateName = self.selectedTemplateName;
			const domain = domainFromRoute ?? authStore.getDomain();

			if (!domain || !packageName || !templateName) {
				return;
			}

			const version = self.selectedTemplateVersion;
			const requestMeta = buildRestUrl(domain, "IaCTemplate", "get", {
				packageName,
				templateName,
				itemId: templateName,
				templateVersion: version,
			});

			self.templateRunState = "loading";
			self.templateRunError = null;
			self.templateRunResult = null;

			try {
				const result: string = yield api.runIacTemplate(
					domain,
					packageName,
					templateName,
					version
				);
				if (self.selectedTemplateName !== templateName) {
					return;
				}
				self.templateRunResult = result;
				self.templateRunState = "loaded";
				const runPath = iacTemplateRunUri(domain, packageName, templateName, {
					version: version ?? undefined,
				});
				publishRestLoadReport({
					objectKind: "IaCTemplate",
					domain,
					responseFormat: "iac-template-run",
					restCount: 1,
					loadedCount: 1,
					restIds: [templateName],
					loadedIds: [templateName],
					errors: [],
					loadedAt: new Date().toISOString(),
					request: {
						method: "GET",
						path: runPath,
						fullUrl: `${config.apiRoot}${runPath}`,
						httpStatus: 200,
						responseBody: result,
					},
				});
			} catch (error) {
				if (self.selectedTemplateName !== templateName) {
					return;
				}
				const message = error instanceof Error ? error.message : "Run fehlgeschlagen.";
				self.templateRunState = "error";
				self.templateRunError = message;
				publishRestLoadReport(
					createRestLoadFailureReport("IaCTemplate", error, {
						domain,
						restUrlIds: {
							packageName,
							templateName,
							itemId: templateName,
							templateVersion: version,
						},
					})
				);
			}
		});

		const uploadTemplate = flow(function* uploadTemplate(
			packageName: string,
			xmlText: string,
			domainFromRoute?: string
		) {
			if (!isEditable(self)) {
				return;
			}

			const domain = domainFromRoute ?? authStore.getDomain();
			if (!domain) {
				return;
			}

			const validation = validateIacTemplateXml(xmlText);
			if (!validation.ok) {
				iacWriteErrorRegistry.setFailure({
					templateKey: iacTemplateWriteKey(packageName, "upload"),
					packageName,
					templateName: "upload",
					method: "POST",
					path: "",
					fullUrl: "",
					message: validation.message,
					payload: xmlText,
				});
				return;
			}

			const parsed = parseIacTemplateXml(xmlText);
			const requestMeta = buildRestUrl(domain, "IaCTemplate", "create", {
				packageName,
				templateName: parsed.id,
				itemId: parsed.id,
			});

			iacWriteErrorRegistry.clear();

			try {
				yield api.postIacTemplate(domain, packageName, parsed.id, xmlText);
				yield loadTemplatesForPackage(packageName, domain, true);
				yield selectTemplate(packageName, parsed.id, domain, null);
			} catch (error) {
				iacWriteErrorRegistry.setFailure(
					restFailureFromError(error, requestMeta, packageName, parsed.id, xmlText)
				);
			}
		});

		const deleteSelectedTemplates = flow(function* deleteSelectedTemplates(
			domainFromRoute?: string
		) {
			if (!isEditable(self)) {
				return;
			}

			const domain = domainFromRoute ?? authStore.getDomain();
			if (!domain) {
				return;
			}

			const keys = self.selectedTemplateKeys.slice();
			iacWriteErrorRegistry.clear();

			for (const key of keys) {
				const parsed = parseIacTemplateSelectionKey(key);
				if (!parsed) {
					continue;
				}

				const { packageName, templateName } = parsed;
				const requestMeta = buildRestUrl(domain, "IaCTemplate", "delete", {
					packageName,
					templateName,
					itemId: templateName,
					templateVersion: self.selectedTemplateVersion,
				});

				try {
					yield api.deleteIacTemplate(
						domain,
						packageName,
						templateName,
						self.selectedTemplateVersion
					);
					const templates = self.templatesByPackage.get(packageName);
					if (templates) {
						const index = templates.findIndex((entry) => entry.name === templateName);
						if (index >= 0) {
							templates.splice(index, 1);
						}
					}
					removeTemplateFromCaches(packageName, templateName);
				} catch (error) {
					iacWriteErrorRegistry.setFailure(
						restFailureFromError(error, requestMeta, packageName, templateName)
					);
					break;
				}
			}
		});

		const downloadSelectedTemplates = flow(function* downloadSelectedTemplates(
			domainFromRoute?: string
		) {
			const domain = domainFromRoute ?? authStore.getDomain();
			if (!domain) {
				return;
			}

			const keys =
				self.selectedTemplateKeys.length > 0
					? self.selectedTemplateKeys.slice()
					: self.selectedPackageName && self.selectedTemplateName
						? [iacTemplateSelectionKey(self.selectedPackageName, self.selectedTemplateName)]
						: [];

			for (const key of keys) {
				const parsed = parseIacTemplateSelectionKey(key);
				if (!parsed) {
					continue;
				}

				const { packageName, templateName } = parsed;
				let xml: string | undefined = self.templateXmlCacheByKey.get(key);
				if (!xml) {
					try {
						const fetched: string = yield api.getIacTemplate(
							domain,
							packageName,
							templateName,
							self.selectedTemplateVersion
						);
						xml = fetched;
						cacheTemplate(packageName, templateName, fetched);
					} catch (error) {
						const requestMeta = buildRestUrl(domain, "IaCTemplate", "get", {
							packageName,
							templateName,
							itemId: templateName,
							templateVersion: self.selectedTemplateVersion,
						});
						iacWriteErrorRegistry.setFailure(
							restFailureFromError(error, requestMeta, packageName, templateName)
						);
						break;
					}
				}

				if (!xml) {
					continue;
				}

				const meta = self.templateMetaByKey.get(key);
				let filename = meta?.filename;
				if (!filename) {
					try {
						filename = parseIacTemplateXml(xml).filename;
					} catch {
						filename = `${templateName}.xml`;
					}
				}
				downloadTextAsFile(filename, xml);
			}
		});

		function updateTextTemplate(newText: string) {
			if (!isEditable(self)) {
				return;
			}
			if (!self.templateEditXml) return;

			const updatedXml = self.templateEditXml.replace(
				/<texttemplate>[\s\S]*?<\/texttemplate>/i,
				`<texttemplate>${newText}</texttemplate>`
			);

			// Korrigiert: Direkter Aufruf der lokalen Funktion
			setTemplateEditXml(updatedXml);
		}

		return {
			setTemplateEditXml,
			discardTemplateEdit,
			setSelectedTemplateKeys,
			setSelectedTemplateVersion,
			loadPackages,
			loadTemplatesForPackage,
			selectTemplate,
			updateTextTemplate,
			loadTemplate,
			reloadSelectedTemplateVersion,
			saveTemplate,
			runTemplate,
			uploadTemplate,
			deleteSelectedTemplates,
			downloadSelectedTemplates,
		};
	});

export type IIaCStore = Instance<typeof IaCStore>;