/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { Instance, getIdentifier, getRoot, getSnapshot, types } from "mobx-state-tree";
import { ITreeNode } from "../../Interfaces/Tree";
import { IRootStore } from "../Root.Store";
import { AssetModel, IAsset } from "./Asset.Model";
import ElementModel, { ElementDefinitionTagModel } from "./Element.Model";
import { resolveTreeNodeElementType } from "../../lib/treeNodeDisplay";

function resolveAssetIdFromRef(ref: { id: unknown }): string | undefined {
	if (typeof ref.id === "string" && ref.id !== "") {
		return ref.id;
	}
	if (ref.id) {
		return getIdentifier(ref.id as IAsset) ?? undefined;
	}
	return undefined;
}

function resolveAssetFromRef(
	ref: { id: unknown },
	root: IRootStore,
	fallbackId?: string
): IAsset | undefined {
	const assetId = resolveAssetIdFromRef(ref) || fallbackId;

	if (!assetId) {
		return undefined;
	}

	return root.assets.assets.find((asset: IAsset) => asset.id === assetId);
}

function collectGroupAssets(group: { id: string; elementIdRefs: Array<{ id: unknown }> }, root: IRootStore, groupSnapshot?: { elementIdRefs?: Array<{ id: string }> }): IAsset[] {
	const snapshot = groupSnapshot ?? { elementIdRefs: [] as Array<{ id: string }> };
	const assetById = new Map<string, IAsset>();

	group.elementIdRefs.forEach((ref, index) => {
		const fallbackId = snapshot.elementIdRefs?.[index]?.id;
		const asset = resolveAssetFromRef(ref, root, fallbackId);
		if (asset) {
			assetById.set(asset.id, asset);
		}
	});

	root.assets.assets.forEach((asset: IAsset) => {
		if (asset.ownerIdRef === group.id) {
			assetById.set(asset.id, asset);
		}
	});

	return Array.from(assetById.values());
}

function assetToTreeNode(root: IRootStore, element: IAsset): ITreeNode {
	return {
		key: element.id,
		class: element.class,
		title: element.definition?.name,
		storeType: element.definition?.storeType,
		baseType: element.definition.baseType,
		subType: element.definition.subType,
		elementType:
			resolveTreeNodeElementType(root, element.definition) || element.definition.type,
		description: element.definition.description,
		label: element.definition.label,
		status: element.status,
		children: element.childrenAsTreeNodes() as ITreeNode[],
	};
}

/**
 * A single group model which will have links and filters attached to it
 */
export const GroupModel = types.compose(
	ElementModel,
	types
		.model("Group", {
			id: types.identifier,
			definition: types.model({
				storeType: types.optional(types.string, ""),
				baseType: types.string,
				type: types.optional(types.string, ""),
				subType: types.string,
				name: types.string,
				label: types.optional(types.string, ""),
				description: types.string,
				tags: types.optional(types.array(ElementDefinitionTagModel), []),
			}),
			parentIdRef: types.maybe(types.string),
			elementIdRefs: types.array(
				types.model({
					id: types.string,
				})
			),
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
				notations: types.frozen(),
				style: types.model({
					bgColor: types.maybeNull(types.string),
					graph: types.model({
						layout: types.maybeNull(types.string),
					}),
				}),
			}),
			settings: types.map(types.frozen()),
		})
		// .volatile(() => ({ }))
		// .actions((self) => ({ }))
		.views((self) => ({
			/**
			 * Provide the Object Type
			 */
			get class(): string {
				return "Group";
			},

			/**
			 * Generates a tree node for the group
			 */
			childrenAsTreeNodes(): ITreeNode[] {
				const root = getRoot(self) as IRootStore;

				const groupChildren = root.groups.groups.filter(
					(group: IGroup) => group.parentIdRef === self.id
				);

				const groupSnapshot = getSnapshot(self) as { elementIdRefs?: Array<{ id: string }> };
				const referencedAssets = collectGroupAssets(self, root, groupSnapshot);

				const childrenCombined: Array<IGroup | IAsset> = [
					...groupChildren,
					...referencedAssets,
				];

				return childrenCombined.map((element) => {
					if (!element) {
						return {
							key: "",
							class: "GROUP",
							title: "Asset-Referenz ungültig",
							baseType: "NONE",
							subType: "NONE",
							description: "",
							status: "untouched",
							children: [],
						};
					}

					if (element.class === "Asset") {
						return assetToTreeNode(root, element as IAsset);
					}

					const group = element as IGroup;
					return {
						key: group.id,
						class: group.class,
						title: group.definition?.name,
						storeType: group.definition?.storeType,
						baseType: group.definition?.baseType,
						subType: group.definition?.subType,
						elementType:
							resolveTreeNodeElementType(root, group.definition) ||
							group.definition?.type,
						description: group.definition.description,
						label: group.definition?.label ?? "",
						status: group.status,
						children: group.childrenAsTreeNodes(),
					};
				});
			},

			/**
			 * Provides all kind of its children (as full data set)
			 */
			children(): IGroup[] {
				const root = getRoot(self) as IRootStore;

				const groupChildren = root.groups.groups.filter(
					(group: IGroup) => group.parentIdRef === self.id
				);

				const groupSnapshot = getSnapshot(self) as { elementIdRefs?: Array<{ id: string }> };
				const referencedAssets = collectGroupAssets(self, root, groupSnapshot);

				return [...groupChildren, ...referencedAssets] as IGroup[];
			},

			/**
			 * Convenience method to get the ids of the assets
			 */
			get assetIds(): string[] {
				const root = getRoot(self) as IRootStore;
				return self.elementIdRefs
					.map((ref) => resolveAssetIdFromRef(ref) ?? "")
					.filter((id) => id !== "" && root.assets.assets.some((asset: IAsset) => asset.id === id));
			},
		}))
).actions((self) => ({
	setParentIdRef(parentId: string | undefined) {
		self.beginEdit();
		self.parentIdRef = parentId;
		self.markTouched();
	},
	setElementIdRefs(refs: Array<{ id: string }>) {
		self.beginEdit();
		self.elementIdRefs.replace(refs);
		self.markTouched();
	},
	setFilterRules(rules: unknown[]) {
		self.beginEdit();
		self.filterRules.replace(rules);
		self.markTouched();
	},
}));

// Typescript type / interface export
export interface IGroup extends Instance<typeof GroupModel> {}