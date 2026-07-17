import { TreeElement } from "../Interfaces/Element";
import { GraphConfig, loadGraphConfig, resolveSwimlaneForTags } from "./graphConfig";
import { readElementGraphTags } from "./graphElementStyle";

export type GraphViewNode = {
	id: string;
	element: TreeElement;
	swimlaneId: string;
	condensed: boolean;
};

export function resolveGraphConfigForView(viewSettings?: { get?: (key: string) => unknown }): GraphConfig {
	if (!viewSettings || typeof viewSettings.get !== "function") {
		return loadGraphConfig();
	}
	const embedded = viewSettings.get("graph");
	if (embedded && typeof embedded === "object") {
		return loadGraphConfig(embedded as Partial<GraphConfig>);
	}
	return loadGraphConfig();
}

export function collectGraphViewNodes(
	root: TreeElement,
	options: {
		depth: number;
		config?: GraphConfig;
		collapseBelowDepth?: number;
	}
): GraphViewNode[] {
	const config = options.config ?? loadGraphConfig();
	const nodes: GraphViewNode[] = [];

	function walk(node: TreeElement, currentDepth: number, parentIsCondensed: boolean) {
		if (!node?.definition) {
			return;
		}
		const condensed =
			parentIsCondensed ||
			(options.collapseBelowDepth != null && currentDepth >= options.collapseBelowDepth);
		const tags = readElementGraphTags(node);
		const swimlane = resolveSwimlaneForTags(config, tags);

		nodes.push({
			id: node.id,
			element: node,
			swimlaneId: swimlane.id,
			condensed,
		});

		if (currentDepth >= options.depth || condensed) {
			return;
		}
		if (typeof node.children === "function") {
			for (const child of node.children()) {
				if (child && (child as TreeElement).definition) {
					walk(child as TreeElement, currentDepth + 1, condensed);
				}
			}
		}
	}

	walk(root, 0, false);
	return nodes;
}

export function groupNodesBySwimlane(
	nodes: GraphViewNode[]
): Map<string, GraphViewNode[]> {
	const grouped = new Map<string, GraphViewNode[]>();
	for (const node of nodes) {
		const list = grouped.get(node.swimlaneId) ?? [];
		list.push(node);
		grouped.set(node.swimlaneId, list);
	}
	return grouped;
}
