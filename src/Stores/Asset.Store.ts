/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { Instance, applySnapshot, flow, getSnapshot, types, getRoot } from "mobx-state-tree";
import { BaseStore } from "./Base.Store";
import { IRootStore } from "./Root.Store";
import { ActiveElement } from "../Interfaces/Element";
import { AssetModel, IAsset } from "./Models/Asset.Model";
import authStore from "./Auth.Store";
import { stampEnvironmentId } from "../lib/environmentIdentity";
import {
	knownEnvironmentIds,
	resolveViewEnvironmentRefs,
	resolveWriteEnvironmentId,
} from "../lib/viewEnvironments";
import { AssetDetailsModel } from "./Models/AssetDetails.Model";
import { generateResourceID } from "../lib/common";
import api from "../lib/api";
import {
	createRestLoadFailureReport,
	enrichRestLoadReport,
	loadRestArrayIntoStore,
	normalizeRestArray,
	publishRestLoadReport,
} from "../lib/restSnapshot";
import { ISchemaModel } from "./Models/Schema.Model";
import { resolveComponentDefinitionTypesForCreate } from "../lib/elementDefinitionTypes";
import { isNewElementStatus } from "../lib/elementStaging";
import { restWritePayloadForAsset } from "../lib/restWritePayload";


/**
 * Asset Store
 */
export const AssetStore = types.compose("Asset", BaseStore, types.model({
	assets: types.array(AssetModel),
	assetDetails: types.optional(types.array(AssetDetailsModel), [])
})).actions(self => {

	/**
	 * Called after the store is created by MST.
	 * Assets werden über den Router-Loader geladen (kein doppeltes loadAssets hier).
	 */
	function afterCreate() {
	}

	// Add a save action
	const store = flow(function* saveData(viewID: string, assetID: string) {
		const root = getRoot(self) as any;

		if (viewID === undefined) {
			// nothing to do
		} else {
			try {
				// Replace with your save logic (e.g., sending data to a server)
				const data = self.assets.find(asset => asset.id === assetID);
				if (!data) {
					return;
				}
				const env = resolveWriteEnvironmentId(
					knownEnvironmentIds(root),
					root.ui.activeView,
					data.environmentId
				);
				if (env && data.environmentId !== env) {
					data.setEnvironmentId(env);
				}
				const isCreate = isNewElementStatus(data.status, data.statusBeforeInvalid);
				const url = `/${authStore.getDomain()}/environments/${env}/assets${
					isCreate ? "" : "/" + assetID
				}`;

				const response = yield api.request(url, {
					method: isCreate ? "POST" : "PUT",
					body: JSON.stringify(restWritePayloadForAsset(getSnapshot(data))),
				});

				if (response.ok) {
					// Handle success
					data?.setStatus("untouched");
					console.log("Asset saved successfully.");
				} else {
					const responseBody = yield response.text();
					alert("Fehler beim Speichern der Assetdaten: " + response.statusText + responseBody);
					console.error("Fehler beim Speichern der Assetdaten: " + response.statusText, responseBody);
				}
			} catch (error) {
				alert("Unbekannter Fehler beim Speichern des Asset");
				console.error("Error saving data:", error);
			}
		}
	});

	/**
	 * Loader for a single container content, types as any because of cyclic reference
	 */
	const loadAssetsForEnvironments = flow(function* loadAssetsForEnvironments(
		environmentIds: string[]
	) {
		const domain = authStore.getDomain();
		if (!domain) {
			return;
		}
		if (environmentIds.length === 0) {
			self.assets.clear();
			return;
		}

		const merged: unknown[] = [];
		const seen = new Set<string>();
		for (const environmentId of environmentIds) {
			const jsonData = yield api.getAssets(domain, environmentId);
			const { items } = normalizeRestArray(jsonData);
			for (const item of items) {
				if (!item || typeof item !== "object") {
					continue;
				}
				const stamped = stampEnvironmentId(item as Record<string, unknown>, environmentId);
				const id = String(stamped.id ?? "");
				if (!id || seen.has(id)) {
					continue;
				}
				seen.add(id);
				merged.push(stamped);
			}
		}

		const restUrlIds = { env: environmentIds[0] };
		const report = enrichRestLoadReport(
			loadRestArrayIntoStore(self.assets, AssetModel, merged, "Asset", {
				domain,
				restUrlIds,
			}),
			"Asset",
			domain,
			restUrlIds
		);
		publishRestLoadReport(report);
	});

	const loadAssets = flow(function* loadContent() {
		if (self.loading) {
			return;
		}

		self.loading = true;
		const root = getRoot(self) as any;
		const domain = authStore.getDomain();
		const environmentIds = resolveViewEnvironmentRefs(
			root.ui.activeView,
			knownEnvironmentIds(root)
		);

		try {
			if (!domain) {
				return;
			}

			yield loadAssetsForEnvironments(environmentIds);

			const viewId = root.ui.activeView?.id;
			if (viewId) {
				yield root.groups.load(viewId);
			} else {
				root.ui.rebindActiveElement();
			}
		} catch (error) {
			if (domain) {
				publishRestLoadReport(
					createRestLoadFailureReport("Asset", error, {
						domain,
						restUrlIds: { env: environmentIds[0] },
					})
				);
			}
		} finally {
			self.loading = false;
		}
	});

	/**
	 * Loads the details of the assets belonging to active container in the ui store
	 */
	const loadAssetDetails = flow(function* loadAssetDetails() {
		// self.loading = true;
		/*
		const url = `${authStore.getApiRoot()}/${authStore.getDomain()}/environments/${config.environment}-list`;
		const idList = JSON.stringify(rootStore.ui.activeGroup?.assetIds);

		if (rootStore.ui.activeGroup?.assetIds.length !== 0) {
			const response = yield fetch(url, {
				method: "POST",
				headers: {
					Accept: "application/json",
					Authorization: AUTHORIZATION
				},
				body: idList
			});

			if (response.status >= 200 && response.status < 300) {
				const json = yield response.json();
				applySnapshot(self.assetDetails, json);
			// console.log("ASSET Details", json);
			} else {

			}
		} else {
			return [];
		}
		*/

		// self.loading = false;
	});

	function create(schemaId: string, parent: ActiveElement, environmentId?: string) {
		const id = generateResourceID("Asset");
		const root = getRoot(self) as IRootStore;
		const schema =
			root.configSchemas.findSchemaById(schemaId) ??
			root.configSchemas.getSchema("COMPONENT", schemaId);
		if (!schema) {
			throw new Error(`Component-Schema '${schemaId}' nicht gefunden.`);
		}
		const definitionTypes = resolveComponentDefinitionTypesForCreate(schema as ISchemaModel);

		const parentEnvironmentId =
			parent && "environmentId" in parent
				? String((parent as { environmentId?: string }).environmentId ?? "").trim()
				: "";
		const newAsset = AssetModel.create({
			id: id,
			environmentId: resolveWriteEnvironmentId(
				knownEnvironmentIds(root),
				root.ui.activeView,
				environmentId,
				parentEnvironmentId
			),
			definition: {
				storeType: definitionTypes.storeType,
				baseType: definitionTypes.baseType,
				type: definitionTypes.type,
				subType: definitionTypes.subType,
				name: root.i18n.text("general.element_new_component_name"),
				label: root.i18n.text("general.element_new_component_label"),
				description: ""
			},
			ownerIdRef: parent?.id,
			docks: [],
			attachments: [],
			properties: {
				responsibles: [],
				notations: [],
				style: {
					bgColor: "",
					graph: {
						layout: null
					}
				},
			}
		});

		console.log("Asset.Store - created new '" + schemaId + "' based on Template ", newAsset);
		self.assets.push(newAsset);
		newAsset.setStatus("new");
		return newAsset;
	}

	function removeLocal(asset: IAsset) {
		const entry = self.assets.find((item) => item.id === asset.id) ?? asset;
		if (self.assets.includes(entry)) {
			self.assets.remove(entry);
		}
	}

	const remove = flow(function* removeAsset(assetId: string) {
		const root = getRoot(self) as any;

		try {
			const asset = root.assets.assets.find((asset: IAsset) => asset.id === assetId);
			const env = resolveWriteEnvironmentId(
				knownEnvironmentIds(root),
				root.ui.activeView,
				asset?.environmentId
			);
			const url = `/${authStore.getDomain()}/environments/${env}/assets/${assetId}`;

			const response = yield api.delete(url);

			if (response.ok) {
				removeLocal(asset);
				console.log("Asset removed successfully.");
			} else {
				const responseBody = yield response.text();
				alert("Fehler beim Löschen des Asset: " + response.statusText + responseBody);
				console.error("Fehler beim Löschen des Asset: " + response.statusText, responseBody);
			}
		} catch (error) {
			alert("Unbekannter Fehler beim Löschen des Asset");
			console.error("Error deleting data:", error);
		}
	});

	function findAssetByDockpartId(dockpartId: string) {
		return self.assets.find((asset) =>
			asset.docks.some((dock) =>
				dock.dockparts.some((part) => String(part.id) === String(dockpartId))
			)
		);
	}

	return {
		loadAssetDetails,
		loadAssets,
		loadAssetsForEnvironments,
		findAssetByDockpartId,
		create,
		store,
		remove,
		removeLocal
	};

});

// export a singleton instance of the asset store
export const assetStore = AssetStore.create({});

// Typescript type / interface export
export interface IAssetStore extends Instance<typeof AssetStore> {} ;
