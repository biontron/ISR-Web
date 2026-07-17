/*
  ========================================================================
  LICENSE AGREEMENT — siehe andere Store-Dateien
  ========================================================================
*/

import { Instance, flow, getSnapshot, types } from "mobx-state-tree";
import { BaseStore } from "./Base.Store";
import { ISchemaModel, SchemaModel } from "./Models/Schema.Model";
import { ConnectSchemaModel, IConnectSchemaModel } from "./Models/ConnectSchema.Model";
import authStore from "./Auth.Store";
import api from "../lib/api";
import { SchemaStoreType, SCHEMA_STORE_TYPES } from "../lib/schemaDomain";
import { resolveDockpartSchemaById } from "../lib/dockpartSchemaResolve";
import {
	findSchemaForDefinition,
	resolveElementSchemaIconCandidates,
} from "../lib/elementDefinitionTypes";
import { patchInternalSchemaRestItems } from "../lib/anyDefinitionTagsSchema";
import { patchConnectionSchemaRestItems } from "../lib/connectionSchemaPatch";
import {
	createRestLoadFailureReport,
	enrichRestLoadReport,
	loadRestArrayIntoStore,
	publishRestLoadReport,
	RestObjectKind,
	normalizeRestArray,
} from "../lib/restSnapshot";

function normalizeSchemaCollectionItems(
	storeType: SchemaStoreType,
	items: unknown[]
): unknown[] {
	if (storeType === "DOCKPART") {
		return items;
	}
	return items.map((entry) => {
		if (!entry || typeof entry !== "object") {
			return entry;
		}
		const item = entry as Record<string, unknown>;
		const normalized: Record<string, unknown> = { ...item };
		// Collection path defines schema storeType; keep payload consistent for later PUT URL selection.
		normalized.storeType = storeType;
		// Guard against previously persisted wrong value (storeType leaked into baseType).
		if (normalized.baseType === "VIEWGROUP") {
			normalized.baseType = "GROUP";
		}
		return normalized;
	});
}

function restKindForStoreType(storeType: SchemaStoreType): RestObjectKind {
	switch (storeType) {
		case "INTERNAL":
			return "InternalSchema";
		case "VIEWGROUP":
			return "ViewGroupSchema";
		case "COMPONENT":
			return "ComponentSchema";
		case "DOCKPART":
			return "DockpartSchema";
	}
}

export type IConfigSchemaStore = Instance<typeof ConfigSchemaStore>;

export const ConfigSchemaStore = types
	.compose(
		"ConfigSchemaStore",
		BaseStore,
		types.model({
			internals: types.optional(types.array(SchemaModel), []),
			viewgroups: types.optional(types.array(SchemaModel), []),
			components: types.optional(types.array(SchemaModel), []),
			dockparts: types.optional(types.array(ConnectSchemaModel), []),
		})
	)
	.views((self) => ({
		getSchemas(storeType: SchemaStoreType): (ISchemaModel | IConnectSchemaModel)[] {
			switch (storeType) {
				case "INTERNAL":
					return self.internals.slice();
				case "VIEWGROUP":
					return self.viewgroups.slice();
				case "COMPONENT":
					return self.components.slice();
				case "DOCKPART":
					return self.dockparts.slice();
				default:
					return [];
			}
		},
		get schemaCompat(): ISchemaModel[] {
			return [...self.internals, ...self.viewgroups, ...self.components];
		},
		findSchemaById(id: string): ISchemaModel | undefined {
			return self.internals.concat(self.viewgroups, self.components).find((item) => item.id === id);
		},
		findSchemaForDefinition(
			definition: { baseType?: string; type?: string; subType?: string } | undefined
		): ISchemaModel | undefined {
			return findSchemaForDefinition(
				[...self.internals, ...self.viewgroups, ...self.components],
				definition
			);
		},
		/** @deprecated Mehrdeutig — nutze findSchemaById oder findSchemaForDefinition */
		findSchemaByType(typeOrId: string, _subType: string): ISchemaModel | undefined {
			return (
				this.findSchemaById(typeOrId) ??
				self.internals.concat(self.viewgroups, self.components).find((item) => item.type === typeOrId)
			);
		},
		getIconByDefinition(
			definition: { baseType?: string; type?: string; subType?: string } | undefined
		) {
			const schema = this.findSchemaForDefinition(definition);
			if (schema?.style.treeIcon) {
				return schema.style.treeIcon;
			}
			const schemas = self.internals.concat(self.viewgroups, self.components);
			for (const candidate of resolveElementSchemaIconCandidates(definition)) {
				const match = schemas.find(
					(item) => item.id === candidate || item.type === candidate
				);
				if (match?.style.treeIcon) {
					return match.style.treeIcon;
				}
			}
			return undefined;
		},
		getIconByType(baseType: string, subType: string, elementType?: string) {
			return this.getIconByDefinition({ baseType, subType, type: elementType });
		},
		findDockpartById(id: string): IConnectSchemaModel | undefined {
			return self.dockparts.find((item) => item.id === id);
		},
		findDockpartByType(type: string): IConnectSchemaModel | undefined {
			return self.dockparts.find((item) => item.type === type || item.id === type);
		},
		resolveDockpartSchema(schemaId: string) {
			return resolveDockpartSchemaById(schemaId, self.dockparts);
		},
		getSchema(storeType: SchemaStoreType, id: string) {
			return this.getSchemas(storeType).find((entry) => entry.id === id);
		},
	}))
	.actions((self) => {
		const loadByStoreType = flow(function* loadByStoreType(
			storeType: SchemaStoreType,
			domainFromRoute?: string
		) {
			const domain = domainFromRoute ?? authStore.getDomain();
			const restKind = restKindForStoreType(storeType);

			if (!domain) {
				publishRestLoadReport(
					createRestLoadFailureReport(
						restKind,
						new Error("Keine Domain für Schema-Laden gesetzt."),
						{ domain }
					)
				);
				return;
			}

			try {
				const jsonData: unknown = yield api.getSchemaList(domain, storeType);
				const { items: restItems } = normalizeRestArray(jsonData);
				const schemaItems =
					storeType === "INTERNAL"
						? patchConnectionSchemaRestItems(patchInternalSchemaRestItems(restItems))
						: restItems;
				const normalizedSchemaItems = normalizeSchemaCollectionItems(storeType, schemaItems);

				const targetArray =
					storeType === "INTERNAL"
						? self.internals
						: storeType === "VIEWGROUP"
							? self.viewgroups
							: storeType === "COMPONENT"
								? self.components
								: self.dockparts;
				const modelType = storeType === "DOCKPART" ? ConnectSchemaModel : SchemaModel;

				const report = enrichRestLoadReport(
					loadRestArrayIntoStore(targetArray, modelType, normalizedSchemaItems, restKind, {
						domain,
						restUrlIds: { schemaStoreType: storeType },
					}),
					restKind,
					domain,
					{ schemaStoreType: storeType }
				);
				publishRestLoadReport(report);
			} catch (error) {
				publishRestLoadReport(
					createRestLoadFailureReport(restKind, error, {
						domain,
						restUrlIds: { schemaStoreType: storeType },
					})
				);
			}
		});

		const loadAll = flow(function* loadAll(domainFromRoute?: string) {
			const domain = domainFromRoute ?? authStore.getDomain();
			if (!domain) {
				return;
			}
			if (self.loading) {
				return;
			}
			self.loading = true;
			try {
				for (const storeType of SCHEMA_STORE_TYPES) {
					yield loadByStoreType(storeType, domain);
				}
			} finally {
				self.loading = false;
			}
		});

		const saveSchema = flow(function* saveSchema(
			schema: ISchemaModel | IConnectSchemaModel,
			domainFromRoute?: string
		) {
			const domain = domainFromRoute ?? authStore.getDomain();
			if (!domain) {
				throw new Error("Keine Domain für Schema-Speichern gesetzt.");
			}
			const body = getSnapshot(schema) as object;
			yield api.putSchemaItem(domain, schema.storeType, schema.id, body);
		});

		const createSchema = flow(function* createSchema(
			schema: ISchemaModel | IConnectSchemaModel,
			domainFromRoute?: string
		) {
			const domain = domainFromRoute ?? authStore.getDomain();
			if (!domain) {
				throw new Error("Keine Domain für Schema-Anlegen gesetzt.");
			}
			const body = getSnapshot(schema) as object;
			yield api.postSchemaItem(domain, schema.storeType, schema.id, body);

			const targetArray =
				schema.storeType === "INTERNAL"
					? self.internals
					: schema.storeType === "VIEWGROUP"
						? self.viewgroups
						: schema.storeType === "COMPONENT"
							? self.components
							: self.dockparts;
			targetArray.push(schema);
		});

		return {
			loadByStoreType,
			/** @deprecated Nutze loadByStoreType */
			loadByBaseType: loadByStoreType,
			loadAll,
			saveSchema,
			createSchema,
		};
	});
