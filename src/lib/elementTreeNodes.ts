import { getIdentifier } from "mobx-state-tree";
import { ITreeNode } from "../Interfaces/Tree";
import { indexAssetsByOwnerId, indexById, indexGroupsByParentId } from "./hierarchyIndex";

type TreeDefinition = {
	storeType?: string;
	baseType?: string;
	type?: string;
	subType?: string;
	name?: string;
	label?: string;
	description?: string;
};

type TreeAsset = {
	id: string;
	class?: string;
	status?: string;
	environmentId?: string | null;
	ownerIdRef?: string | null;
	definition?: TreeDefinition;
};

type TreeGroup = {
	id: string;
	class?: string;
	status?: string;
	parentIdRef?: string | null;
	elementIdRefs?: Array<{ id: unknown; environmentId?: unknown }>;
	filterRules?: unknown[];
	definition?: TreeDefinition;
};

type TreeAssignable = TreeGroup | TreeAsset;

type TreeRoot = {
	groups: { groups: TreeGroup[] };
	assets: { assets: TreeAsset[] };
};

export type TreeParentSpec = {
	id: string;
	class?: string;
	filterRules?: unknown[];
	elementIdRefs?: Array<{ id: unknown; environmentId?: unknown }>;
};

type TreeBuildContext = {
	parentKey?: string;
	ancestorIds: ReadonlySet<string>;
	index: TreeIndex;
};

type TreeIndex = {
	groupsByParent: Map<string, TreeGroup[]>;
	assetsByOwner: Map<string, TreeAsset[]>;
	assetsById: Map<string, TreeAsset>;
};

function buildTreeIndex(root: TreeRoot): TreeIndex {
	return {
		groupsByParent: indexGroupsByParentId(root.groups.groups),
		assetsByOwner: indexAssetsByOwnerId(root.assets.assets),
		assetsById: indexById(root.assets.assets),
	};
}

export function treeNodeElementId(node: Pick<ITreeNode, "key" | "elementId">): string {
	const elementId = node.elementId?.trim();
	if (elementId) {
		return elementId;
	}
	const key = node.key?.trim() ?? "";
	const slash = key.lastIndexOf("/");
	if (slash < 0) {
		return key;
	}
	const last = key.slice(slash + 1);
	return last.replace(/#\d+$/, "");
}

export function collectTreeKeysForElementId(nodes: ITreeNode[], elementId: string): string[] {
	const keys: string[] = [];
	for (const node of nodes) {
		if (treeNodeElementId(node) === elementId) {
			keys.push(node.key);
		}
		if (node.children?.length) {
			keys.push(...collectTreeKeysForElementId(node.children, elementId));
		}
	}
	return keys;
}

export function collectAncestorKeysForElement(nodes: ITreeNode[], elementId: string): string[] {
	const ancestors: string[] = [];

	function walk(list: ITreeNode[], path: string[]) {
		for (const node of list) {
			if (treeNodeElementId(node) === elementId) {
				ancestors.push(...path);
			}
			if (node.children?.length) {
				walk(node.children, [...path, node.key]);
			}
		}
	}

	walk(nodes, []);
	return Array.from(new Set(ancestors));
}

export function collectTreeRevealKeys(nodes: ITreeNode[], elementId?: string): string[] {
	const firstLevel = nodes.map((node) => node.key);
	if (!elementId) {
		return firstLevel;
	}
	return Array.from(new Set(firstLevel.concat(collectAncestorKeysForElement(nodes, elementId))));
}

function expandKeysFromIdPath(path: string[]): string[] {
	if (path.length < 2) {
		return [];
	}
	const keys: string[] = [];
	let key = path[0];
	keys.push(key);
	for (let index = 1; index < path.length - 1; index += 1) {
		key = `${key}/${path[index]}`;
		keys.push(key);
	}
	return keys;
}

/**
 * Expand-Keys für den Pfad View → Element, auch wenn der Tree die Kinder noch nicht geladen hat.
 */
export function collectTreeExpandKeysForElement(
	root: TreeRoot,
	viewId: string,
	elementId: string
): string[] {
	if (!viewId || !elementId || viewId === elementId) {
		return [];
	}
	const groupsById = indexById(root.groups.groups);
	const assetsById = indexById(root.assets.assets);
	const paths: string[][] = [];

	const walk = (id: string, upward: string[]) => {
		if (upward.includes(id)) {
			return;
		}
		const next = [...upward, id];
		if (id === viewId) {
			const fromView = next.slice(0, -1).reverse();
			if (fromView.length > 0) {
				paths.push(fromView);
			}
			return;
		}
		const group = groupsById.get(id);
		if (group) {
			const parentId = typeof group.parentIdRef === "string" ? group.parentIdRef.trim() : "";
			if (!parentId) {
				return;
			}
			walk(parentId, next);
			return;
		}
		const asset = assetsById.get(id);
		if (!asset) {
			return;
		}
		const ownerId = typeof asset.ownerIdRef === "string" ? asset.ownerIdRef.trim() : "";
		if (ownerId) {
			walk(ownerId, next);
			return;
		}
		for (const groupItem of root.groups.groups) {
			const refs = groupItem.elementIdRefs ?? [];
			if (refs.some((ref) => resolveAssetIdFromRef(ref) === id)) {
				walk(groupItem.id, next);
			}
		}
	};

	walk(elementId, []);
	const keys: string[] = [];
	for (const path of paths) {
		keys.push(...expandKeysFromIdPath(path));
	}
	return uniqueKeys(keys);
}

function uniqueKeys(keys: Iterable<string>): string[] {
	return Array.from(new Set(Array.from(keys)));
}

export { uniqueKeys as uniqueTreeKeys };

function resolveAssetIdFromRef(ref: { id: unknown }): string | undefined {
	if (typeof ref.id === "string" && ref.id !== "") {
		return ref.id;
	}
	if (ref.id) {
		return getIdentifier(ref.id as object) ?? undefined;
	}
	return undefined;
}

function resolveAssetFromRef(
	ref: { id: unknown },
	index: TreeIndex,
	fallbackId?: string
): TreeAsset | undefined {
	const assetId = resolveAssetIdFromRef(ref) || fallbackId;
	if (!assetId) {
		return undefined;
	}
	const byId = index.assetsById.get(assetId);
	const environmentId =
		ref && typeof ref === "object" && "environmentId" in ref
			? String((ref as { environmentId?: string }).environmentId ?? "").trim()
			: "";
	if (environmentId && byId && String(byId.environmentId ?? "") !== environmentId) {
		return byId;
	}
	return byId;
}

function collectReferencedAssets(
	parent: TreeParentSpec,
	index: TreeIndex
): TreeAsset[] {
	const assetById = new Map<string, TreeAsset>();
	const refs = parent.elementIdRefs ?? [];
	refs.forEach((ref, refIndex) => {
		const fallbackId =
			typeof refs[refIndex]?.id === "string" ? (refs[refIndex].id as string) : undefined;
		const asset = resolveAssetFromRef(ref, index, fallbackId);
		if (asset) {
			assetById.set(asset.id, asset);
		}
	});
	const owned = index.assetsByOwner.get(parent.id);
	if (owned) {
		for (const asset of owned) {
			assetById.set(asset.id, asset);
		}
	}
	return Array.from(assetById.values());
}

function childTreeKey(parentKey: string | undefined, elementId: string, used: Set<string>): string {
	const base = parentKey ? `${parentKey}/${elementId}` : elementId;
	if (!used.has(base)) {
		used.add(base);
		return base;
	}
	let index = 2;
	let next = `${base}#${index}`;
	while (used.has(next)) {
		index += 1;
		next = `${base}#${index}`;
	}
	used.add(next);
	return next;
}

function collectDirectChildren(
	parent: TreeParentSpec,
	index: TreeIndex
): Array<TreeAssignable | null> {
	const parentClass = parent.class ?? "";

	if (parentClass === "Asset") {
		return index.assetsByOwner.get(parent.id) ?? [];
	}

	const groupChildren = index.groupsByParent.get(parent.id) ?? [];
	const referencedAssets =
		parentClass === "Group" || parentClass === "View"
			? collectReferencedAssets(parent, index)
			: index.assetsByOwner.get(parent.id) ?? [];

	if (parentClass === "View") {
		const staticAssets = index.assetsByOwner.get(parent.id) ?? [];
		return [...groupChildren, ...staticAssets];
	}

	return [...groupChildren, ...referencedAssets];
}

function elementMayHaveChildren(
	element: TreeAssignable,
	inCycle: boolean,
	index: TreeIndex
): boolean {
	if (inCycle) {
		return false;
	}
	if (element.class === "Asset") {
		return (index.assetsByOwner.get(element.id)?.length ?? 0) > 0;
	}
	if ((index.groupsByParent.get(element.id)?.length ?? 0) > 0) {
		return true;
	}
	const refs = (element as TreeGroup).elementIdRefs ?? [];
	if (refs.some((ref) => resolveAssetIdFromRef(ref))) {
		return true;
	}
	return (index.assetsByOwner.get(element.id)?.length ?? 0) > 0;
}

function toTreeNode(element: TreeAssignable, key: string, isLeaf: boolean): ITreeNode {
	const definition = element.definition;
	return {
		key,
		elementId: element.id,
		class: element.class,
		title: definition?.name ?? "",
		storeType: definition?.storeType,
		baseType: definition?.baseType,
		subType: definition?.subType,
		elementType: definition?.type,
		description: definition?.description,
		label: definition?.label ?? "",
		status: element.status,
		isLeaf,
		children: isLeaf ? [] : undefined,
	};
}

function buildChildNodes(
	parent: TreeParentSpec,
	context: TreeBuildContext
): ITreeNode[] {
	const usedKeys = new Set<string>();
	return collectDirectChildren(parent, context.index).map((element, index) => {
		if (!element) {
			const key = childTreeKey(context.parentKey, `invalid-${index}`, usedKeys);
			return {
				key,
				elementId: "",
				class: "GROUP",
				title: "Asset-Referenz ungültig",
				baseType: "NONE",
				subType: "NONE",
				description: "",
				status: "untouched",
				isLeaf: true,
				children: [],
			};
		}

		const key = childTreeKey(context.parentKey, element.id, usedKeys);
		const inCycle = context.ancestorIds.has(element.id);
		return toTreeNode(element, key, !elementMayHaveChildren(element, inCycle, context.index));
	});
}

export function ancestorIdsFromTreeKey(key: string, viewId?: string): Set<string> {
	const ids = new Set<string>();
	if (viewId) {
		ids.add(viewId);
	}
	for (const segment of key.split("/")) {
		const elementId = segment.replace(/#\d+$/, "").trim();
		if (elementId) {
			ids.add(elementId);
		}
	}
	return ids;
}

function findUnloadedExpandedNode(
	nodes: ITreeNode[],
	expandedKeys: Set<string>
): ITreeNode | undefined {
	for (const node of nodes) {
		if (expandedKeys.has(String(node.key)) && !node.isLeaf && !node.children?.length) {
			return node;
		}
		if (node.children?.length) {
			const nested = findUnloadedExpandedNode(node.children, expandedKeys);
			if (nested) {
				return nested;
			}
		}
	}
	return undefined;
}

/** Lädt Kinder für bereits aufgeklappte Knoten nach einem Tree-Rebuild nach. */
export function fillExpandedTreeNodes(
	root: TreeRoot & {
		views?: { views: TreeParentSpec[] };
		groups: { groups: TreeParentSpec[] };
		assets: { assets: TreeParentSpec[] };
	},
	nodes: ITreeNode[],
	expandedKeys: Iterable<string>,
	viewId?: string
): ITreeNode[] {
	const expanded = new Set(Array.from(expandedKeys).map(String).filter(Boolean));
	if (expanded.size === 0) {
		return nodes;
	}
	const index = buildTreeIndex(root);
	let tree = nodes;
	for (let step = 0; step < 40; step += 1) {
		const pending = findUnloadedExpandedNode(tree, expanded);
		if (!pending) {
			break;
		}
		const elementId = treeNodeElementId(pending);
		const parent = resolveTreeParentSpec(root, elementId);
		if (!parent) {
			tree = setTreeNodeChildren(tree, pending.key, []);
			continue;
		}
		const ancestorIds = ancestorIdsFromTreeKey(String(pending.key), viewId);
		ancestorIds.add(elementId);
		const children = buildElementTreeNodes(root, parent, {
			parentKey: String(pending.key),
			ancestorIds,
			index,
		});
		tree = setTreeNodeChildren(tree, pending.key, children);
	}
	return tree;
}

export function setTreeNodeChildren(
	nodes: ITreeNode[],
	key: string,
	children: ITreeNode[]
): ITreeNode[] {
	return nodes.map((node) => {
		if (node.key === key) {
			return { ...node, children, isLeaf: children.length === 0 };
		}
		if (node.children?.length) {
			return { ...node, children: setTreeNodeChildren(node.children, key, children) };
		}
		return node;
	});
}

export function resolveTreeParentSpec(
	root: {
		views?: { views: TreeParentSpec[] };
		groups: { groups: TreeParentSpec[] };
		assets: { assets: TreeParentSpec[] };
	},
	elementId: string
): TreeParentSpec | undefined {
	const view = root.views?.views?.find((item) => item.id === elementId);
	if (view) {
		return view;
	}
	const group = root.groups.groups.find((item) => item.id === elementId);
	if (group) {
		return group;
	}
	return root.assets.assets.find((item) => item.id === elementId);
}

export function buildElementTreeNodes(
	root: TreeRoot,
	parent: TreeParentSpec,
	context?: Partial<TreeBuildContext>
): ITreeNode[] {
	const ancestorIds = context?.ancestorIds ?? new Set([parent.id]);
	const index = context?.index ?? buildTreeIndex(root);
	return buildChildNodes(parent, {
		parentKey: context?.parentKey,
		ancestorIds,
		index,
	});
}
