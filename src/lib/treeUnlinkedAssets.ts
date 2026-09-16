import { getIdentifier } from "mobx-state-tree";
import { IAsset } from "../Stores/Models/Asset.Model";
import { IGroup } from "../Stores/Models/Group.Model";
import { IRootStore } from "../Stores/Root.Store";
import { readGroupParentId } from "./elementAssignments";
import { indexAssetsByOwnerId, indexGroupsByParentId } from "./hierarchyIndex";

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
	const childrenByParent = indexGroupsByParentId(root.groups.groups as unknown as IGroup[]);

	const walk = (parentId: string) => {
		const children = childrenByParent.get(parentId);
		if (!children) {
			return;
		}
		for (const group of children) {
			groups.push(group);
			walk(group.id);
		}
	};

	walk(viewId);
	return groups;
}

function addAssetAndOwnerDescendants(
	assetId: string,
	linked: Set<string>,
	childrenByOwner: Map<string, IAsset[]>
) {
	if (!assetId || linked.has(assetId)) {
		return;
	}
	linked.add(assetId);
	const children = childrenByOwner.get(assetId);
	if (!children) {
		return;
	}
	for (const child of children) {
		addAssetAndOwnerDescendants(child.id, linked, childrenByOwner);
	}
}

/** Asset-IDs, die in der View-Hierarchie hängen (parentIdRef, ownerIdRef, elementIdRefs). */
export function collectLinkedAssetIdsForView(root: IRootStore, viewId: string): Set<string> {
	const linked = new Set<string>();
	const viewGroups = collectViewGroupsUnderView(root, viewId);
	const parentIds = new Set<string>([viewId, ...viewGroups.map((group) => group.id)]);
	const childrenByOwner = indexAssetsByOwnerId(root.assets.assets as unknown as IAsset[]);

	for (const group of viewGroups) {
		for (const ref of group.elementIdRefs) {
			const assetId = resolveElementRefId(ref);
			if (assetId) {
				addAssetAndOwnerDescendants(assetId, linked, childrenByOwner);
			}
		}
	}

	parentIds.forEach((parentId) => {
		const owned = childrenByOwner.get(parentId);
		if (!owned) {
			return;
		}
		for (const asset of owned) {
			addAssetAndOwnerDescendants(asset.id, linked, childrenByOwner);
		}
	});

	return linked;
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
export function collectUnlinkedGroupsForView(
	root: IRootStore,
	viewId: string | undefined
): IGroup[] {
	if (!viewId) {
		return [];
	}

	const linkedIds = new Set(collectViewGroupsUnderView(root, viewId).map((group) => group.id));
	const knownParents = collectKnownParentIds(root, viewId);

	return root.groups.groups.filter((group) => {
		if (linkedIds.has(group.id)) {
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
export function collectUnlinkedAssetsForView(
	root: IRootStore,
	viewId: string | undefined
): IAsset[] {
	if (!viewId) {
		return [];
	}

	const linked = collectLinkedAssetIdsForView(root, viewId);
	return root.assets.assets.filter((asset) => !linked.has(asset.id));
}

export type UnlinkedTreeElement = IGroup | IAsset;

export type UnlinkedElementNode = {
	element: UnlinkedTreeElement;
	children: UnlinkedElementNode[];
};

function isUnlinkedAsset(element: UnlinkedTreeElement): element is IAsset {
	return element.class === "Asset";
}

function collectUnlinkedNodeIds(nodes: UnlinkedElementNode[], into: Set<string>) {
	for (const node of nodes) {
		into.add(node.element.id);
		if (node.children.length > 0) {
			collectUnlinkedNodeIds(node.children, into);
		}
	}
}

export function countUnlinkedElementNodes(nodes: UnlinkedElementNode[]): number {
	let count = 0;
	const walk = (list: UnlinkedElementNode[]) => {
		for (const node of list) {
			count += 1;
			if (node.children.length > 0) {
				walk(node.children);
			}
		}
	};
	walk(nodes);
	return count;
}

/** Hängt unverknüpfte Stack-Components (ownerIdRef) als Sub-Baum unter ihre Wurzel. */
export function nestUnlinkedStackedComponents(
	elements: UnlinkedTreeElement[]
): UnlinkedElementNode[] {
	const assets: IAsset[] = [];
	const others: UnlinkedTreeElement[] = [];
	for (const element of elements) {
		if (isUnlinkedAsset(element)) {
			assets.push(element);
		} else {
			others.push(element);
		}
	}

	const unlinkedAssetIds = new Set(assets.map((asset) => asset.id));
	const childrenByOwner = indexAssetsByOwnerId(assets);

	function buildAssetNode(asset: IAsset, ancestors: Set<string>): UnlinkedElementNode {
		const nextAncestors = new Set(ancestors);
		nextAncestors.add(asset.id);
		const stacked = (childrenByOwner.get(asset.id) ?? []).filter((child) => {
			return unlinkedAssetIds.has(child.id) && !nextAncestors.has(child.id);
		});
		return {
			element: asset,
			children: stacked.map((child) => buildAssetNode(child, nextAncestors)),
		};
	}

	const roots: UnlinkedElementNode[] = others.map((element) => ({
		element,
		children: [],
	}));

	for (const asset of assets) {
		const ownerId = typeof asset.ownerIdRef === "string" ? asset.ownerIdRef.trim() : "";
		if (ownerId && unlinkedAssetIds.has(ownerId)) {
			continue;
		}
		roots.push(buildAssetNode(asset, new Set()));
	}

	const placed = new Set<string>();
	collectUnlinkedNodeIds(roots, placed);
	for (const asset of assets) {
		if (placed.has(asset.id)) {
			continue;
		}
		const leftover = buildAssetNode(asset, new Set());
		roots.push(leftover);
		collectUnlinkedNodeIds([leftover], placed);
	}

	return roots;
}

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

export function collectUnlinkedElementForestForView(
	root: IRootStore,
	viewId: string | undefined
): UnlinkedElementNode[] {
	return nestUnlinkedStackedComponents(collectUnlinkedElementsForView(root, viewId));
}
