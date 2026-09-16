/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { Instance, cast, getIdentifier, getRoot, types } from "mobx-state-tree";
import { ITreeNode } from "../../Interfaces/Tree";
import { IRootStore } from "../Root.Store";
import { IAsset } from "./Asset.Model";
import ElementModel, { ElementDefinitionTagModel } from "./Element.Model";
import { ElementIdRefModel } from "./ElementIdRef.Model";
import { FilterRuleModel } from "./FilterRule.Model";
import { normalizeFilterRules, toFilterRuleRecord } from "../../lib/filterRuleNormalize";
import { resolvePrimaryEnvironmentRef } from "../../lib/viewEnvironments";
import { buildElementTreeNodes } from "../../lib/elementTreeNodes";

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
	ref: { id: unknown; environmentId?: string },
	root: IRootStore,
	fallbackId?: string
): IAsset | undefined {
	const assetId = resolveAssetIdFromRef(ref) || fallbackId;

	if (!assetId) {
		return undefined;
	}

	const byId = root.assets.assetById.get(assetId);
	const environmentId = String(ref.environmentId ?? "").trim();
	if (environmentId && byId && String(byId.environmentId ?? "") !== environmentId) {
		return (
			root.assets.assets.find(
				(asset: IAsset) =>
					asset.id === assetId && String(asset.environmentId ?? "") === environmentId
			) ?? byId
		);
	}

	return byId;
}

function collectGroupAssets(group: { id: string; elementIdRefs: Array<{ id: unknown; environmentId?: string }> }, root: IRootStore, groupSnapshot?: { elementIdRefs?: Array<{ id: string }> }): IAsset[] {
	const snapshot = groupSnapshot ?? { elementIdRefs: [] as Array<{ id: string }> };
	const collected = new Map<string, IAsset>();

	group.elementIdRefs.forEach((ref, index) => {
		const fallbackId = snapshot.elementIdRefs?.[index]?.id;
		const asset = resolveAssetFromRef(ref, root, fallbackId);
		if (asset) {
			collected.set(asset.id, asset);
		}
	});

	const owned = root.assets.assetsByOwnerId.get(group.id);
	if (owned) {
		for (const asset of owned) {
			collected.set(asset.id, asset);
		}
	}

	return Array.from(collected.values());
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
			elementIdRefs: types.array(ElementIdRefModel),
			filterRules: types.array(FilterRuleModel),
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
			 * Direct children as tree nodes (one level — Tree lädt tiefer nach).
			 */
			childrenAsTreeNodes(): ITreeNode[] {
				const root = getRoot(self) as IRootStore;
				return buildElementTreeNodes(root, self);
			},

			/**
			 * Provides all kind of its children (as full data set)
			 */
			children(): IGroup[] {
				const root = getRoot(self) as IRootStore;

				const groupChildren = root.groups.groups.filter(
					(group: IGroup) => group.parentIdRef === self.id
				);

				const referencedAssets = collectGroupAssets(self, root);

				return [...groupChildren, ...referencedAssets] as IGroup[];
			},

			/**
			 * Convenience method to get the ids of the assets
			 */
			get assetIds(): string[] {
				const root = getRoot(self) as IRootStore;
				return self.elementIdRefs
					.map((ref) => resolveAssetIdFromRef(ref) ?? "")
					.filter((id) => id !== "" && root.assets.assetById.has(id));
			},
		}))
).actions((self) => ({
	setParentIdRef(parentId: string | undefined) {
		self.beginEdit();
		self.parentIdRef = parentId;
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
		const root = getRoot(self) as IRootStore;
		const primary = resolvePrimaryEnvironmentRef(root.ui?.activeView);
		self.filterRules = cast(
			normalizeFilterRules(rules).map((rule) =>
				toFilterRuleRecord(
					rule.environments.length > 0 || !primary
						? rule
						: { ...rule, environments: [{ ref: primary }] }
				)
			)
		);
		self.markTouched();
	},
}));

// Typescript type / interface export
export interface IGroup extends Instance<typeof GroupModel> {}