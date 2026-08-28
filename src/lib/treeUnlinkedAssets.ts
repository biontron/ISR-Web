import { getIdentifier } from "mobx-state-tree";
import { IAsset } from "../Stores/Models/Asset.Model";
import { IGroup } from "../Stores/Models/Group.Model";
import { IRootStore } from "../Stores/Root.Store";
import { readAssetOwnerId, readGroupParentId } from "./elementAssignments";
import { collectFilterMatchedElements } from "./elementXPathFilter";

function resolveElementRefId(ref: { id: unknown }): string | undefined {
	if (typeof ref.id === "string" && ref.id.trim() !== "") {
		return ref.id.trim();
	}
	if (ref.id) {
		return getIdentifier(ref.id as IAsset) ?? undefined;
	}
	return undefined;
}

/** Alle View-Organisationsgruppen unter einer View (rekursiv über parentIdRef). */
export function collectViewGroupsUnderView(root: IRootStore, viewId: string): IGroup[] {
	const groups: IGroup[] = [];

	function walk(parentId: string) {
		for (const group of root.groups.groups) {
			if (readGroupParentId(group) === parentId) {
				groups.push(group);
				walk(group.id);
			}
		}
	}

	walk(viewId);
	return groups;
}

function addAssetAndOwnerDescendants(
	root: IRootStore,
	assetId: string,
	linked: Set<string>
) {
	if (!assetId || linked.has(assetId)) {
		return;
	}
	linked.add(assetId);
	for (const asset of root.assets.assets) {
		const ownerId =
			typeof asset.ownerIdRef === "string" ? asset.ownerIdRef.trim() : "";
		if (ownerId === assetId) {
			addAssetAndOwnerDescendants(root, asset.id, linked);
		}
	}
}

/** Asset-IDs, die in der View-Hierarchie hängen (parentIdRef, ownerIdRef, elementIdRefs). */
export function collectLinkedAssetIdsForView(root: IRootStore, viewId: string): Set<string> {
	const linked = new Set<string>();
	const viewGroups = collectViewGroupsUnderView(root, viewId);
	const parentIds = new Set<string>([viewId, ...viewGroups.map((group) => group.id)]);

	for (const group of viewGroups) {
		for (const ref of group.elementIdRefs) {
			const assetId = resolveElementRefId(ref);
			if (assetId) {
				addAssetAndOwnerDescendants(root, assetId, linked);
			}
		}
	}

	for (const asset of root.assets.assets) {
		const ownerId =
			typeof asset.ownerIdRef === "string" ? asset.ownerIdRef.trim() : "";
		if (ownerId && parentIds.has(ownerId)) {
			addAssetAndOwnerDescendants(root, asset.id, linked);
		}
	}

	return linked;
}

function readFilterRules(element: { filterRules?: unknown[] } | undefined): unknown[] {
	return element?.filterRules ?? [];
}

function findView(
	root: IRootStore,
	viewId: string
): { id: string; filterRules?: unknown[] } | undefined {
	return root.views?.views?.find((view: { id: string }) => view.id === viewId);
}

/**
 * Elemente, die nur über XPath-Filter im Tree der View sichtbar sind (ohne parentIdRef/ownerIdRef).
 */
export function collectFilterVisibleIdsForView(root: IRootStore, viewId: string): Set<string> {
	const visible = new Set<string>();
	const walkedParents = new Set<string>();

	const addVisibleAsset = (assetId: string) => {
		addAssetAndOwnerDescendants(root, assetId, visible);
	};

	const addVisibleGroup = (group: IGroup) => {
		if (visible.has(group.id) && walkedParents.has(group.id)) {
			return;
		}
		visible.add(group.id);
		for (const child of root.groups.groups) {
			if (readGroupParentId(child) === group.id) {
				addVisibleGroup(child);
			}
		}
		for (const ref of group.elementIdRefs ?? []) {
			const assetId = resolveElementRefId(ref);
			if (assetId) {
				addVisibleAsset(assetId);
			}
		}
		for (const asset of root.assets.assets) {
			if (readAssetOwnerId(asset) === group.id) {
				addVisibleAsset(asset.id);
			}
		}
		walkParent(group.id, readFilterRules(group));
	};

	function walkParent(parentId: string, rules: unknown[]) {
		if (walkedParents.has(parentId)) {
			return;
		}
		walkedParents.add(parentId);
		for (const element of collectFilterMatchedElements(root, parentId, rules)) {
			if (element.class === "Group") {
				addVisibleGroup(element as IGroup);
			} else {
				addVisibleAsset(element.id);
			}
		}
	}

	walkParent(viewId, readFilterRules(findView(root, viewId)));
	for (const group of collectViewGroupsUnderView(root, viewId)) {
		walkParent(group.id, readFilterRules(group));
	}
	return visible;
}

function collectKnownParentIds(root: IRootStore, viewId: string): Set<string> {
	const ids = new Set<string>([viewId]);
	for (const group of root.groups.groups) {
		ids.add(group.id);
	}
	const views = root.views?.views;
	if (views) {
		for (const view of views) {
			ids.add(view.id);
		}
	}
	return ids;
}

/** Ausgehängte View-Folder (ohne gültigen Parent, nicht im Tree der aktiven View). */
export function collectUnlinkedGroupsForView(root: IRootStore, viewId: string | undefined): IGroup[] {
	if (!viewId) {
		return [];
	}

	const linkedIds = new Set(collectViewGroupsUnderView(root, viewId).map((group) => group.id));
	const xpathVisible = collectFilterVisibleIdsForView(root, viewId);
	const knownParents = collectKnownParentIds(root, viewId);

	return root.groups.groups.filter((group) => {
		if (linkedIds.has(group.id) || xpathVisible.has(group.id)) {
			return false;
		}
		const parentId = readGroupParentId(group);
		if (!parentId) {
			return true;
		}
		return !knownParents.has(parentId);
	});
}

/** Komponenten ohne Zuordnung in der aktiven View. */
export function collectUnlinkedAssetsForView(root: IRootStore, viewId: string | undefined): IAsset[] {
	if (!viewId) {
		return [];
	}

	const linked = collectLinkedAssetIdsForView(root, viewId);
	const xpathVisible = collectFilterVisibleIdsForView(root, viewId);
	return root.assets.assets.filter(
		(asset) => !linked.has(asset.id) && !xpathVisible.has(asset.id)
	);
}

export type UnlinkedTreeElement = IGroup | IAsset;

/** Unverknüpfte View-Folder und technische Elemente der aktiven View. */
export function collectUnlinkedElementsForView(
	root: IRootStore,
	viewId: string | undefined
): UnlinkedTreeElement[] {
	return [
		...collectUnlinkedGroupsForView(root, viewId),
		...collectUnlinkedAssetsForView(root, viewId),
	];
}
