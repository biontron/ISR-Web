/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { Instance, getRoot, types } from "mobx-state-tree";
import { IGroup } from "./Group.Model";
import { IAsset } from "./Asset.Model";
import ElementModel, { ElementDefinitionTagModel } from "./Element.Model";
import { resolveTreeNodeElementType } from "../../lib/treeNodeDisplay";


/**
 * A single view model (tree entry point)
 */
export const ViewModel = types.compose(
	ElementModel,
	types
		.model("View", {
			id: types.identifier,
			definition: types.model({
				storeType: types.optional(types.string, ""),
				baseType: types.string,
				type: types.optional(types.string, ""),
				subType: types.string,
				name: types.string,
				description: types.string,
				tags: types.optional(types.array(ElementDefinitionTagModel), []),
			}),
			filterRules: types.array(types.frozen()),
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
		})
		// .volatile(() => ({ }))
		// .actions((self) => ({}))
		.views((self) => ({
			/**
			 * Provide the Object Type
			 */
			get class(): string {
				return "View";
			},

			/**
			 * Generates a tree node for the view
			 * @returns ITreeNode as stacked data structure for tree view
			 */
			childrenAsTreeNodes() {
				const root = getRoot(self) as any;
				if (!root.groups.groups) {
					return [{
						key: "",
						class: "VIEW",
						title: "ERROR VIEW",
						baseType: "NONE",
						subType: "NONE",
						description: "",
						status: "untouched",
						children: [],
					}];
				}
				const groupNodes = root.groups.groups
					.filter(
						(element: IGroup) => element.parentIdRef === self.id
					)
					.map((element: IGroup) => {
						return {
							key: element.id,
							class: element.class,
							title: element.definition.name,
							storeType: element.definition.storeType,
							baseType: element.definition.baseType,
							subType: element.definition.subType,
							elementType:
								resolveTreeNodeElementType(root, element.definition) ||
								element.definition.type,
							description: element?.definition.description,
							label: element?.definition?.label ?? "",
							status: element?.status,
							children: element.childrenAsTreeNodes(),
						};
					});
				const assetNodes = (root.assets?.assets ?? [])
					.filter((asset: IAsset) => asset.ownerIdRef === self.id)
					.map((element: IAsset) => ({
						key: element.id,
						class: element.class,
						title: element.definition?.name,
						storeType: element.definition?.storeType,
						baseType: element.definition.baseType,
						subType: element.definition.subType,
						elementType:
							resolveTreeNodeElementType(root, element.definition) ||
							element.definition.type,
						description: element.definition.description,
						label: element.definition.label,
						status: element.status,
						children: element.childrenAsTreeNodes(),
					}));
				return [...groupNodes, ...assetNodes];
			},

			/**
			 * Provides all kind of its children (as full data set)
			 */
			children() {
				const root = getRoot(self) as any;
				const groups = root.groups.groups.filter(
					(element: IGroup) => element.parentIdRef === self.id
				);
				const assets = (root.assets?.assets ?? []).filter(
					(asset: IAsset) => asset.ownerIdRef === self.id
				);
				return [...groups, ...assets];
			},
		}))
).actions((self) => ({
	setFilterRules(rules: unknown[]) {
		self.beginEdit();
		self.filterRules.replace(rules);
		self.markTouched();
	},
}));

// Build custom resolver for Views - This is need to lazily set the activeView when the router changes
export const ViewLazyRef = types.maybeNull(
	types.safeReference(ViewModel, {
		// given an identifier, find the user
		get(identifier, parent: any) {
			const root = getRoot(parent) as any;
			return root.views.views.find((vType: IView) => vType.id === identifier) || null;
		},
		// given a user, produce the identifier that should be stored
		set(value: any) {
			return value.id as string;
		}
	})
);

// Typescript type / interface export
export interface IView extends Instance<typeof ViewModel> {}
