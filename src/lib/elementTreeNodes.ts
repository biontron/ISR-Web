import { getIdentifier } from "mobx-state-tree";
import { ITreeNode } from "../Interfaces/Tree";
import { collectFilterMatchedFromPool } from "./elementXPathFilter";
import { filterRuleExpression } from "./filterRuleNormalize";

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
	elementIdRefs?: Array<{ id: unknown }>;
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
	elementIdRefs?: Array<{ id: unknown }>;
};

type FilterMatchIndex = {
	match(parentId: string, rules: unknown[] | undefined, excludeIds: Iterable<string>): TreeAssignable[];
};

type TreeBuildContext = {
	parentKey?: string;
	ancestorIds: ReadonlySet<string>;
	filterIndex: FilterMatchIndex;
};

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

function uniqueKeys(keys: Iterable<string>): string[] {
	return Array.from(new Set(Array.from(keys)));
}

export { uniqueKeys as uniqueTreeKeys };

function isNonEmptyId(value: unknown): value is string {
	return typeof value === "string" && value.trim() !== "";
}

function readGroupParentId(group: Pick<TreeGroup, "parentIdRef">): string | undefined {
	return isNonEmptyId(group.parentIdRef) ? group.parentIdRef.trim() : undefined;
}

function readAssetOwnerId(asset: Pick<TreeAsset, "ownerIdRef">): string | undefined {
	return isNonEmptyId(asset.ownerIdRef) ? String(asset.ownerIdRef).trim() : undefined;
}

function isStaticallyUnassigned(element: TreeAssignable): boolean {
	if (element.class === "Group") {
		return readGroupParentId(element as TreeGroup) === undefined;
	}
	return readAssetOwnerId(element as TreeAsset) === undefined;
}

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
	root: TreeRoot,
	fallbackId?: string
): TreeAsset | undefined {
	const assetId = resolveAssetIdFromRef(ref) || fallbackId;
	if (!assetId) {
		return undefined;
	}
	const environmentRef =
		ref && typeof ref === "object" && "environmentRef" in ref
			? String((ref as { environmentRef?: string }).environmentRef ?? "").trim()
			: "";
	if (environmentRef) {
		return (
			root.assets.assets.find(
				(asset) => asset.id === assetId && String(asset.environmentId ?? "") === environmentRef
			) ?? root.assets.assets.find((asset) => asset.id === assetId)
		);
	}
	return root.assets.assets.find((asset) => asset.id === assetId);
}

function collectReferencedAssets(
	parent: TreeParentSpec,
	root: TreeRoot
): TreeAsset[] {
	const assetById = new Map<string, TreeAsset>();
	const refs = parent.elementIdRefs ?? [];
	refs.forEach((ref, index) => {
		const fallbackId =
			typeof refs[index]?.id === "string" ? (refs[index].id as string) : undefined;
		const asset = resolveAssetFromRef(ref, root, fallbackId);
		if (asset) {
			assetById.set(asset.id, asset);
		}
	});
	root.assets.assets.forEach((asset) => {
		if (readAssetOwnerId(asset) === parent.id) {
			assetById.set(asset.id, asset);
		}
	});
	return Array.from(assetById.values());
}

function createFilterMatchIndex(root: TreeRoot): FilterMatchIndex {
	const unassigned: TreeAssignable[] = [
		...root.groups.groups.filter((group) => isStaticallyUnassigned(group)),
		...root.assets.assets.filter((asset) => isStaticallyUnassigned(asset)),
	];
	const cache = new Map<string, TreeAssignable[]>();

	return {
		match(parentId, rules, excludeIds) {
			const expressions = Array.from(rules ?? []).map(filterRuleExpression).filter(Boolean);
			if (expressions.length === 0) {
				return [];
			}
			const cacheKey = expressions.join("\n");
			let matched = cache.get(cacheKey);
			if (!matched) {
				matched = collectFilterMatchedFromPool(unassigned as never, rules ?? []);
				cache.set(cacheKey, matched);
			}
			const skip = new Set(excludeIds);
			skip.add(parentId);
			return matched.filter((element) => !skip.has(element.id));
		},
	};
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
	root: TreeRoot,
	parent: TreeParentSpec,
	filterIndex: FilterMatchIndex
): Array<TreeAssignable | null> {
	const parentClass = parent.class ?? "";

	if (parentClass === "Asset") {
		return root.assets.assets.filter((asset) => readAssetOwnerId(asset) === parent.id);
	}

	const groupChildren = root.groups.groups.filter(
		(group) => readGroupParentId(group) === parent.id
	);
	const referencedAssets =
		parentClass === "Group" || parentClass === "View"
			? collectReferencedAssets(parent, root)
			: root.assets.assets.filter((asset) => readAssetOwnerId(asset) === parent.id);

	if (parentClass === "View") {
		const staticAssets = root.assets.assets.filter(
			(asset) => readAssetOwnerId(asset) === parent.id
		);
		const existingIds = [
			...groupChildren.map((group) => group.id),
			...staticAssets.map((asset) => asset.id),
		];
		const filterMatched = filterIndex.match(parent.id, parent.filterRules, existingIds);
		return [...groupChildren, ...staticAssets, ...filterMatched];
	}

	const existingIds = [
		...groupChildren.map((group) => group.id),
		...referencedAssets.map((asset) => asset.id),
	];
	const filterMatched = filterIndex.match(parent.id, parent.filterRules, existingIds);
	return [...groupChildren, ...referencedAssets, ...filterMatched];
}

function elementMayHaveChildren(
	root: TreeRoot,
	element: TreeAssignable,
	inCycle: boolean
): boolean {
	if (inCycle) {
		return false;
	}
	if (element.class === "Asset") {
		return root.assets.assets.some((asset) => readAssetOwnerId(asset) === element.id);
	}
	if (root.groups.groups.some((group) => readGroupParentId(group) === element.id)) {
		return true;
	}
	const refs = (element as TreeGroup).elementIdRefs ?? [];
	if (refs.some((ref) => resolveAssetIdFromRef(ref))) {
		return true;
	}
	if (root.assets.assets.some((asset) => readAssetOwnerId(asset) === element.id)) {
		return true;
	}
	return Array.from((element as TreeGroup).filterRules ?? []).some(
		(rule) => filterRuleExpression(rule) !== ""
	);
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
	root: TreeRoot,
	parent: TreeParentSpec,
	context: TreeBuildContext
): ITreeNode[] {
	const usedKeys = new Set<string>();
	return collectDirectChildren(root, parent, context.filterIndex).map((element, index) => {
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
		return toTreeNode(element, key, !elementMayHaveChildren(root, element, inCycle));
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
	context?: Partial<Omit<TreeBuildContext, "filterIndex">> & { filterIndex?: FilterMatchIndex }
): ITreeNode[] {
	const ancestorIds = context?.ancestorIds ?? new Set([parent.id]);
	const filterIndex = context?.filterIndex ?? createFilterMatchIndex(root);
	return buildChildNodes(root, parent, {
		parentKey: context?.parentKey,
		ancestorIds,
		filterIndex,
	});
}
