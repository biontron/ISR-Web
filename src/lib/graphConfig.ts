import graphConfigDocument from "../config/graph-config.json";
import { getLanguageText } from "./common";
import { rootStore } from "../Stores/Root.Store";

export type GraphVisualStyle = {
	type?: string;
	fill?: string;
	fillOpacity?: number;
	stroke?: string;
	strokeWidth?: number;
	strokeDasharray?: string;
	lineColor?: string;
	lineWidth?: number;
	lineOpacity?: number;
	lineDasharray?: string;
	labelColor?: string;
};

export type GraphSwimlaneLabel = string | Record<string, string>;

export type GraphSwimlaneConfig = {
	id: string;
	label: GraphSwimlaneLabel;
	tags: string[];
};

export type GraphConfig = {
	version: number;
	containerDefault: GraphVisualStyle;
	containers: Record<string, GraphVisualStyle>;
	nodeDefault?: GraphVisualStyle;
	nodeChildDefault?: GraphVisualStyle;
	edgeDefault: GraphVisualStyle;
	activeHighlight?: { stroke?: string; strokeWidth?: number };
	swimlanes: GraphSwimlaneConfig[];
};

export const DEFAULT_GRAPH_CONFIG = graphConfigDocument as GraphConfig;

export function loadGraphConfig(override?: Partial<GraphConfig>): GraphConfig {
	if (!override) {
		return DEFAULT_GRAPH_CONFIG;
	}
	return {
		...DEFAULT_GRAPH_CONFIG,
		...override,
		containerDefault: {
			...DEFAULT_GRAPH_CONFIG.containerDefault,
			...override.containerDefault,
		},
		edgeDefault: {
			...DEFAULT_GRAPH_CONFIG.edgeDefault,
			...override.edgeDefault,
		},
		containers: {
			...DEFAULT_GRAPH_CONFIG.containers,
			...override.containers,
		},
		swimlanes:
			override.swimlanes?.length ? override.swimlanes : DEFAULT_GRAPH_CONFIG.swimlanes,
	};
}

export function resolveContainerPreset(
	config: GraphConfig,
	layoutKey: string | null | undefined
): GraphVisualStyle {
	const key = layoutKey?.trim();
	if (key && config.containers[key]) {
		return config.containers[key];
	}
	return config.containerDefault;
}

export function resolveSwimlaneLabel(
	lane: Pick<GraphSwimlaneConfig, "label">,
	lang: string = rootStore.i18n.lang
): string {
	if (typeof lane.label === "string") {
		return lane.label;
	}
	return getLanguageText(lane.label, lang);
}

/** Hashtag-Vergleich: #database und database sind gleichwertig. */
export function normalizeHashtagForMatch(tag: string): string {
	return tag.trim().toLowerCase().replace(/^#+/, "");
}

export function resolveSwimlaneForTags(
	config: GraphConfig,
	elementTags: string[]
): GraphSwimlaneConfig {
	const normalized = elementTags
		.map(normalizeHashtagForMatch)
		.filter(Boolean);
	for (const lane of config.swimlanes) {
		if (lane.tags.length === 0) {
			continue;
		}
		const laneTags = lane.tags.map(normalizeHashtagForMatch);
		if (normalized.some((tag) => laneTags.includes(tag))) {
			return lane;
		}
	}
	return resolveUngroupedSwimlane(config);
}

/** Catch-all-Lane für Elemente ohne passenden Hashtag. */
export function resolveUngroupedSwimlane(config: GraphConfig): GraphSwimlaneConfig {
	return (
		config.swimlanes.find((lane) => lane.id === "ungrouped") ??
		config.swimlanes.find((lane) => lane.tags.length === 0) ??
		config.swimlanes[0] ?? {
			id: "ungrouped",
			label: "Ungruppiert",
			tags: [],
		}
	);
}
