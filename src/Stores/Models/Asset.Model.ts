/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { getRoot, Instance, types } from "mobx-state-tree";
import { ITreeNode } from "../../Interfaces/Tree";
import { IRootStore } from "../Root.Store";
import { IAssetDetails } from "./AssetDetails.Model";
import ElementModel, { ElementDefinitionTagModel } from "./Element.Model";
import { DockModel } from "./Dock.Model";
import { ISchemaGroupModel } from "./SchemaGroup.Model";
import { buildDockEntryFromSchemaItems, buildDockpartEntry } from "../../lib/assetSchemaMutations";

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
			elementIdRefs: types.array(
				types.model({
					id: types.string,
				})
			),
			contextMemberships: types.optional(
				types.array(
					types.model({
						contextGroupRef: types.string,
						contextLabelSnapshot: types.optional(types.string, ""),
					})
				),
				[]
			),
			filterRules: types.array(types.frozen()),
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
			 * Generates the children of the asset - if full is true, it will also generate the children of the children
			 * Otherwise it will only generate the children of the asset itself
			 * @param {boolean} [full=true]
			 * @returns {*}
			 */
			childrenAsTreeNodes(): ITreeNode[] {
				const root = getRoot(self) as any;

				const childrenAssets = root.assets.assets.filter(
					(asset: IAsset) => self.id === asset.ownerIdRef
				);

				return childrenAssets.map((element: IAsset) => ({
					key: element.id,
					class: element.class,
					title: element.definition?.name,
					storeType: element.definition?.storeType,
					baseType: element.definition.baseType,
					subType: element.definition.subType,
					elementType: element.definition.type,
					description: element.definition.description,
					label: element.definition.label,
					status: element.status,
					children: element.childrenAsTreeNodes() as ITreeNode[],
				}));
			},

			/**
			 * Provides all kind of its children (as partitial data set)
			 */
			children(): IAsset[] {
				const root = getRoot(self) as any;

				const childrenAssets = root.assets.assets.filter(
					(asset: IAsset) => {
						return self.id === asset.ownerIdRef;
					}
				);
				return childrenAssets;
			},
		}))
).actions((self) => ({
	addDock(schemaItems?: ISchemaGroupModel["items"]) {
		self.beginEdit();
		const entry = schemaItems?.length
			? buildDockEntryFromSchemaItems(self as IAsset, "docks", schemaItems)
			: { id: `d${Math.random().toString(36).slice(2, 11)}`, type: "", dockparts: [] };
		self.docks.push(entry as any);
		if (self.status !== "new") {
			self.status = "changed";
		}
	},
	removeDock(dockIndex: number) {
		self.beginEdit();
		self.docks.splice(dockIndex, 1);
		if (self.status !== "new") {
			self.status = "changed";
		}
	},
	appendDockEntry(entry: Record<string, unknown>) {
		self.beginEdit();
		self.docks.push(entry as any);
		if (self.status !== "new") {
			self.status = "changed";
		}
	},
	appendDockpartEntry(dockIndex: number, entry: Record<string, unknown>) {
		if (!self.docks[dockIndex]) {
			return;
		}
		self.beginEdit();
		self.docks[dockIndex].dockparts.push(entry as any);
		if (self.status !== "new") {
			self.status = "changed";
		}
	},
	addDockpart(dockIndex: number, schemaId: string) {
		const root = getRoot(self) as IRootStore;
		const snapshot = buildDockpartEntry(self as IAsset, dockIndex, schemaId, root);
		if (!self.docks[dockIndex]) {
			return;
		}
		self.beginEdit();
		self.docks[dockIndex].dockparts.push(snapshot as any);
		if (self.status !== "new") {
			self.status = "changed";
		}
	},
	removeDockpart(dockIndex: number, partIndex: number) {
		self.beginEdit();
		self.docks[dockIndex].dockparts.splice(partIndex, 1);
		if (self.status !== "new") {
			self.status = "changed";
		}
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
		if (self.status !== "new") {
			self.status = "changed";
		}
	},
	// Neue Actions für Cross-Referencing
	ensureMappingFields() {
		self.beginEdit();

		if (!self.elementIdRefs || self.elementIdRefs.length === undefined) {
			self.elementIdRefs.replace([]);   // ← WICHTIG: .replace()
		}
		if (!self.filterRules || self.filterRules.length === undefined) {
			self.filterRules.replace([]);     // ← WICHTIG: .replace()
		}

		if (self.status !== "new") {
			self.status = "changed";
		}
	},

	setElementIdRefs(refs: Array<{ id: string }>) {
		self.beginEdit();
		self.elementIdRefs.replace(refs);     // ← .replace() statt direkte Zuweisung
		if (self.status !== "new") {
			self.status = "changed";
		}
	},

	setFilterRules(rules: unknown[]) {
		self.beginEdit();
		self.filterRules.replace(rules);      // ← .replace()
		if (self.status !== "new") {
			self.status = "changed";
		}
	},
}));

// Typescript type / interface export
export interface IAsset extends Instance<typeof AssetModel> {}
