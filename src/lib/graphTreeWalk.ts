import { TreeElement } from "../Interfaces/Element";

export type GraphWalkItem = {
	node: TreeElement;
	parentId: string;
	depth: number;
};

export type GraphWalkOptions = {
	maxDepth: number;
	maxNodes: number;
	rootParentId?: string;
	skipChild?: (parent: TreeElement, child: TreeElement) => boolean;
};

function isStructureElement(node: TreeElement): boolean {
	return node.class === "View" || node.class === "Group";
}

function childBucket(parent: TreeElement, child: TreeElement): "structure" | "member" | "nested" {
	if (isStructureElement(child)) {
		return "structure";
	}
	if (isStructureElement(parent)) {
		return "member";
	}
	return "nested";
}

/**
 * View-Folder zuerst vollständig, danach Components je Folder im Round-Robin,
 * damit die letzten Ordner nicht leer bleiben, wenn die Knotengrenze greift.
 */
export function collectPrioritizedGraphWalk(
	root: TreeElement,
	options: GraphWalkOptions
): GraphWalkItem[] {
	if (!root) {
		return [];
	}
	const maxDepth = options.maxDepth;
	const maxNodes = Math.max(0, options.maxNodes);
	const skipChild = options.skipChild;
	const queued = new Set<string>();
	const result: GraphWalkItem[] = [];
	const structure: GraphWalkItem[] = [];
	const membersByParent = new Map<string, GraphWalkItem[]>();
	const nested: GraphWalkItem[] = [];

	function consider(
		parent: TreeElement | undefined,
		item: GraphWalkItem,
		bucket: "structure" | "member" | "nested"
	) {
		if (!item.node?.id || queued.has(item.node.id)) {
			return;
		}
		if (parent && skipChild?.(parent, item.node)) {
			return;
		}
		queued.add(item.node.id);
		if (bucket === "structure") {
			structure.push(item);
			return;
		}
		if (bucket === "member") {
			const list = membersByParent.get(item.parentId) ?? [];
			list.push(item);
			membersByParent.set(item.parentId, list);
			return;
		}
		nested.push(item);
	}

	function enqueueKids(parent: TreeElement, depth: number) {
		if (depth >= maxDepth || typeof parent.children !== "function") {
			return;
		}
		for (const raw of parent.children()) {
			if (!raw || !(raw as TreeElement).definition) {
				continue;
			}
			const child = raw as TreeElement;
			consider(
				parent,
				{ node: child, parentId: parent.id, depth: depth + 1 },
				childBucket(parent, child)
			);
		}
	}

	const rootParentId = options.rootParentId ?? root.id;
	consider(
		undefined,
		{ node: root, parentId: rootParentId, depth: 0 },
		isStructureElement(root) ? "structure" : "member"
	);

	while (structure.length > 0) {
		const item = structure.shift()!;
		result.push(item);
		enqueueKids(item.node, item.depth);
	}

	const parentOrder = Array.from(membersByParent.keys());
	let addedMember = true;
	while (addedMember && result.length < maxNodes) {
		addedMember = false;
		for (const parentId of parentOrder) {
			if (result.length >= maxNodes) {
				break;
			}
			const list = membersByParent.get(parentId);
			if (!list?.length) {
				continue;
			}
			const item = list.shift()!;
			result.push(item);
			enqueueKids(item.node, item.depth);
			addedMember = true;
		}
	}

	let nestedHead = 0;
	while (nestedHead < nested.length && result.length < maxNodes) {
		const item = nested[nestedHead];
		nestedHead += 1;
		result.push(item);
		enqueueKids(item.node, item.depth);
	}

	return result;
}
