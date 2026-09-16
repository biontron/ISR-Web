/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { cast, getRoot, Instance, types } from "mobx-state-tree";
import { ITreeNode } from "../../Interfaces/Tree";
import { IRootStore } from "../Root.Store";
import { IAssetDetails } from "./AssetDetails.Model";
import ElementModel, { ElementDefinitionTagModel } from "./Element.Model";
import { DockModel } from "./Dock.Model";
import { ElementIdRefModel } from "./ElementIdRef.Model";
import { ISchemaGroupModel } from "./SchemaGroup.Model";
import { buildDockEntryFromSchemaItems, buildDockpartEntry } from "../../lib/assetSchemaMutations";
import { refillEmptyBasedOn } from "../../lib/dockpartBasedOn";
import { buildElementTreeNodes } from "../../lib/elementTreeNodes";

/*
{
  "id" : "01a93fa0-1c74-44b1-bafd-6d8a988fea21",
  "definition" : {
    "baseType" : "LIGHT",
    "type" : "DEVICE",
    "subType" : "",
    "name" : "DEVICE"
  }
}
*/

/**
 * A single asset with properties
 */
export const AssetModel = types.compose(
	ElementModel,
	types
		.model("Asset", {
			id: types.identifier,
			definition: types.model({
				storeType: types.optional(types.string, ""),
				baseType: types.string,
				type: types.optional(types.string, ""),
				subType: types.string,
				name: types.string,
				label: types.string,
				description: types.string,
				tags: types.optional(types.array(ElementDefinitionTagModel), []),
			}),
			ownerIdRef: types.maybeNull(types.string),
			docks: types.optional(types.array(DockModel), []),
			attachments: types.array(types.frozen()),
			properties: types.model({
				responsibles: types.array(
					types.model({
						givenName: types.string,
						familyName: types.string,
						email: types.string,
						phone: types.string,
					})
				),
				notations: types.array(types.frozen()),
				style: types.model({
					bgColor: types.string,
					graph: types.model({
						layout: types.maybeNull(types.string),
					}),
				}),
			}),
			settings: types.map(types.frozen()),
			elementIdRefs: types.array(ElementIdRefModel),
			filterRules: types.array(types.frozen()),
			environmentId: types.optional(types.string, ""),
		})
		// .volatile(() => ({ }))
		// .actions((self) => ({ }))
		.views((self) => ({
			/**
			 * Provide the Object Type
			 */
			get class(): string {
				return "Asset";
			},

			/**
			 * Convenience method to get the details of an asset
			 */
			get details(): IAssetDetails {
				const root = getRoot(self) as IRootStore;
				return root.assets.assetDetails.find(
					(detail: IAssetDetails) => detail.id === self
				) as any;
			},

			/**
			 * Direct child assets as tree nodes (one level — Graph/Tree laden tiefer nach).
			 */
			childrenAsTreeNodes(): ITreeNode[] {
				const root = getRoot(self) as IRootStore;
				return buildElementTreeNodes(root, { id: self.id, class: "Asset" });
			},

			/**
			 * Provides all kind of its children (as partitial data set)
			 */
			children(): IAsset[] {
				const root = getRoot(self) as IRootStore;
				return (root.assets.assetsByOwnerId.get(self.id) ?? []) as IAsset[];
			},
		}))
).actions((self) => ({
	addDock(schemaItems?: ISchemaGroupModel["items"]) {
		self.beginEdit();
		const entry = schemaItems?.length
			? buildDockEntryFromSchemaItems(self as IAsset, "docks", schemaItems)
			: { id: `d${Math.random().toString(36).slice(2, 11)}`, type: "", dockparts: [] };
		self.docks.push(entry as any);
		self.markTouched();
	},
	removeDock(dockIndex: number) {
		self.beginEdit();
		self.docks.splice(dockIndex, 1);
		self.markTouched();
	},
	appendDockEntry(entry: Record<string, unknown>) {
		self.beginEdit();
		self.docks.push(entry as any);
		self.markTouched();
	},
	appendDockpartEntry(dockIndex: number, entry: Record<string, unknown>) {
		if (!self.docks[dockIndex]) {
			return;
		}
		self.beginEdit();
		self.docks[dockIndex].dockparts.push(entry as any);
		refillEmptyBasedOn(
			self.docks[dockIndex].dockparts,
			(getRoot(self) as IRootStore).configSchemas.dockparts.slice()
		);
		self.markTouched();
	},
	addDockpart(dockIndex: number, schemaId: string) {
		const root = getRoot(self) as IRootStore;
		const snapshot = buildDockpartEntry(self as IAsset, dockIndex, schemaId, root);
		if (!self.docks[dockIndex]) {
			return;
		}
		self.beginEdit();
		self.docks[dockIndex].dockparts.push(snapshot as any);
		refillEmptyBasedOn(self.docks[dockIndex].dockparts, root.configSchemas.dockparts.slice());
		self.markTouched();
	},
	removeDockpart(dockIndex: number, partIndex: number) {
		self.beginEdit();
		self.docks[dockIndex].dockparts.splice(partIndex, 1);
		refillEmptyBasedOn(
			self.docks[dockIndex].dockparts,
			(getRoot(self) as IRootStore).configSchemas.dockparts.slice()
		);
		self.markTouched();
	},
	/** Legt bei Bedarf ein Dock an und hängt genau ein Dockpart-Element ein */
	addDockpartToAsset(schemaType: string) {
		self.beginEdit();
		let dockIndex = self.docks.findIndex((dock) => dock.dockparts.length === 0);
		if (dockIndex < 0) {
			const entry = { id: `d${Math.random().toString(36).slice(2, 11)}`, type: "", dockparts: [] };
			self.docks.push(entry as any);
			dockIndex = self.docks.length - 1;
		}
		const root = getRoot(self) as IRootStore;
		const snapshot = buildDockpartEntry(self as IAsset, dockIndex, schemaType, root);
		self.docks[dockIndex].dockparts.push(snapshot as any);
		refillEmptyBasedOn(self.docks[dockIndex].dockparts, root.configSchemas.dockparts.slice());
		self.markTouched();
	},
	// Neue Actions für Cross-Referencing
	ensureMappingFields() {
		const refsMissing = !self.elementIdRefs || self.elementIdRefs.length === undefined;
		const rulesMissing = !self.filterRules || self.filterRules.length === undefined;
		if (!refsMissing && !rulesMissing) {
			return;
		}

		self.beginEdit();
		if (refsMissing) {
			self.elementIdRefs.replace([]);
		}
		if (rulesMissing) {
			self.filterRules.replace([]);
		}
		self.markTouched();
	},

	setElementIdRefs(refs: Array<{
		environmentId?: string;
		id: string;
		baseType?: string;
		type?: string;
		subType?: string;
		name?: string;
		label?: string;
	}>) {
		self.beginEdit();
		self.elementIdRefs = cast(
			refs.map((ref) => ({
				environmentId: ref.environmentId ?? "",
				id: ref.id,
				baseType: ref.baseType ?? "",
				type: ref.type ?? "",
				subType: ref.subType ?? "",
				name: ref.name ?? "",
				label: ref.label ?? "",
			}))
		);
		self.markTouched();
	},

	setFilterRules(rules: unknown[]) {
		self.beginEdit();
		self.filterRules.replace(rules);      // ← .replace()
		self.markTouched();
	},

	setOwnerIdRef(ownerId: string | null) {
		self.beginEdit();
		self.ownerIdRef = ownerId;
		self.markTouched();
	},
	setEnvironmentId(environmentId: string) {
		const next = environmentId.trim();
		if (self.environmentId === next) {
			return;
		}
		self.environmentId = next;
	},
}));

// Typescript type / interface export
export interface IAsset extends Instance<typeof AssetModel> {}
