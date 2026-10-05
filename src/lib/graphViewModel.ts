import { TreeElement } from "../Interfaces/Element";
import { rootStore } from "../Stores/Root.Store";
import {
	GraphArchitectureRepresentation,
	GraphConfig,
	GraphRepresentation,
	loadGraphConfig,
	resolveSwimlaneForTags,
} from "./graphConfig";
import { readElementGraphTags } from "./graphElementStyle";
import { resolveViewEnvironmentRefs, ViewEnvironmentSource } from "./viewEnvironments";

export type GraphViewNode = {
	id: string;
	element: TreeElement;
	swimlaneId: string;
	condensed: boolean;
};

export type GraphEnvironmentConfigSource = {
	properties?: { graph?: unknown };
};

export type ResolveGraphConfigOptions = {
	view?: ViewEnvironmentSource | null;
	environments?: readonly GraphEnvironmentConfigSource[];
};

function isArchitecture(entry: unknown): entry is GraphArchitectureRepresentation {
	return !!entry && typeof entry === "object" && (entry as GraphRepresentation).kind === "architecture";
}

export function readGraphArchitectures(graph: unknown): GraphArchitectureRepresentation[] {
	if (!graph || typeof graph !== "object") {
		return [];
	}
	const representations = (graph as { representations?: unknown }).representations;
	if (!Array.isArray(representations)) {
		return [];
	}
	return representations.filter(isArchitecture);
}

function overlayArchitectures(
	base: GraphArchitectureRepresentation[],
	overlay: readonly GraphArchitectureRepresentation[]
): GraphArchitectureRepresentation[] {
	const next = base.slice();
	for (const entry of overlay) {
		const index = next.findIndex((item) => item.id === entry.id);
		if (index >= 0) {
			next[index] = entry;
		} else {
			next.push(entry);
		}
	}
	return next;
}

function environmentsOf(options?: ResolveGraphConfigOptions): readonly GraphEnvironmentConfigSource[] {
	if (options?.environments) {
		return options.environments;
	}
	if (!options?.view) {
		return [];
	}
	const knownIds = rootStore.environments.environments.map((environment) => environment.id);
	const found: GraphEnvironmentConfigSource[] = [];
	for (const ref of resolveViewEnvironmentRefs(options.view, knownIds)) {
		const environment = rootStore.environments.findById(ref);
		if (environment) {
			found.push(environment);
		}
	}
	return found;
}

export function resolveGraphConfigForView(
	viewSettings?: { get?: (key: string) => unknown } | null,
	options?: ResolveGraphConfigOptions
): GraphConfig {
	const embedded =
		viewSettings && typeof viewSettings.get === "function" ? viewSettings.get("graph") : undefined;
	const embeddedRecord =
		embedded && typeof embedded === "object" ? (embedded as Partial<GraphConfig>) : undefined;
	const styleOverride = embeddedRecord ? { ...embeddedRecord } : undefined;
	if (styleOverride) {
		delete styleOverride.representations;
	}
	const base = loadGraphConfig(styleOverride);
	const swimlanes = (base.representations ?? []).filter(
		(entry): entry is GraphRepresentation => entry.kind === "swimlane"
	);
	let architectures = (base.representations ?? []).filter(isArchitecture);
	for (const environment of environmentsOf(options)) {
		architectures = overlayArchitectures(architectures, readGraphArchitectures(environment.properties?.graph));
	}
	return {
		...base,
		representations: [...swimlanes, ...architectures],
	};
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
	const seen = new Set<string>();

	function walk(node: TreeElement, currentDepth: number, parentIsCondensed: boolean) {
		if (!node?.definition || seen.has(node.id)) {
			return;
		}
		seen.add(node.id);
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
