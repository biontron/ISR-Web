import { TreeElement } from "../Interfaces/Element";
import { normalizeElementKindForSchemaMatch } from "./elementDefinitionTypes";
import { GraphConfig, resolveSwimlaneForTags } from "./graphConfig";
import { readElementGraphTags } from "./graphElementStyle";

export type GraphNodeLookup = {
	hasNode(id: string): boolean;
};

/** Components (Assets) werden per Hashtag einer Swimlane zugeordnet. */
export function isSwimlaneComponent(node: TreeElement): boolean {
	if (node.class !== "Asset" && node.class !== "AssetDetails") {
		return false;
	}
	const kind = normalizeElementKindForSchemaMatch(node.definition?.baseType);
	return kind === "COMPONENT" || kind === "";
}

export function collectSwimlaneComponentsFromTree(
	root: TreeElement,
	maxDepth = 10
): TreeElement[] {
	const components: TreeElement[] = [];

	function walk(node: TreeElement, depth: number) {
		if (!node?.definition) {
			return;
		}
		if (isSwimlaneComponent(node)) {
			components.push(node);
		}
		if (depth >= maxDepth || typeof node.children !== "function") {
			return;
		}
		for (const child of node.children()) {
			if (child && (child as TreeElement).definition) {
				walk(child as TreeElement, depth + 1);
			}
		}
	}

	walk(root, 0);
	return components;
}

export function collectSwimlaneComponents(
	root: TreeElement,
	g: GraphNodeLookup,
	maxDepth = 10
): TreeElement[] {
	const components: TreeElement[] = [];

	function walk(node: TreeElement, depth: number) {
		if (!node?.definition || !g.hasNode(node.id)) {
			return;
		}
		if (isSwimlaneComponent(node)) {
			components.push(node);
		}
		if (depth >= maxDepth || typeof node.children !== "function") {
			return;
		}
		for (const child of node.children()) {
			if (child && (child as TreeElement).definition) {
				walk(child as TreeElement, depth + 1);
			}
		}
	}

	walk(root, 0);
	return components;
}

export function swimlaneNodeId(laneId: string): string {
	return `__lane__${laneId}`;
}

export function swimlaneWidthSpacerId(laneNodeId: string): string {
	return `${laneNodeId}__width-spacer`;
}

export function swimlanePlaceholderId(laneNodeId: string): string {
	return `${laneNodeId}__placeholder`;
}

export function resolveSwimlaneIdForComponent(
	component: TreeElement,
	config: GraphConfig
): string {
	const tags = readElementGraphTags(component);
	return resolveSwimlaneForTags(config, tags).id;
}

export function assignComponentsToSwimlanes(
	components: TreeElement[],
	config: GraphConfig
): Map<string, TreeElement[]> {
	const byLane = new Map<string, TreeElement[]>();
	for (const lane of config.swimlanes) {
		byLane.set(lane.id, []);
	}
	for (const component of components) {
		const laneId = resolveSwimlaneIdForComponent(component, config);
		const list = byLane.get(laneId) ?? [];
		list.push(component);
		byLane.set(laneId, list);
	}
	return byLane;
}
