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

export type GraphCellAlign = "start" | "center" | "end";

export type GraphCellRole = "region" | "frame" | "node";

export type GraphLocalizedText = string | Record<string, string>;

/** Zellenblock. Die Komponenten liegen über direkten Link oder Tag in diesem Block. */
export type GraphCellBlock = {
	id: string;
	label?: GraphLocalizedText | null;
	header?: GraphLocalizedText | null;
	range: string;
	role?: GraphCellRole;
	elementIds?: string[];
	tags?: string[];
	previewMembers?: { id: string; label: GraphLocalizedText }[];
	architectureId?: string | null;
	fallback?: boolean;
	dashed?: boolean | null;
	fill?: string | null;
	stroke?: string | null;
	strokeDasharray?: string | null;
	labelColor?: string | null;
	align?: GraphCellAlign | "" | null;
	shape?: "box" | "cylinder" | "c" | "" | null;
	text?: GraphLocalizedText | null;
	textFill?: string | null;
	textStroke?: string | null;
	textStrokeDasharray?: string | null;
	textColor?: string | null;
};

export type GraphArchitectureEdge = {
	from: string;
	to: string;
	bidirectional?: boolean | null;
	lineColor?: string | null;
	arrowColor?: string | null;
};

export type GraphRowBand = {
	label: GraphLocalizedText;
	range: string;
	fill?: string | null;
	stroke?: string | null;
	strokeDasharray?: string | null;
	labelColor?: string | null;
	offset?: number | null;
};

export type GraphSwimlaneRepresentation = {
	kind: "swimlane";
	id: string;
	label: GraphSwimlaneLabel;
	tags: string[];
};

export type GraphArchitectureRepresentation = {
	kind: "architecture";
	id: string;
	label: GraphLocalizedText;
	columns?: string[];
	rows?: string[];
	rowBands?: GraphRowBand[];
	blocks: GraphCellBlock[];
	edges?: GraphArchitectureEdge[];
};

export type GraphRepresentation = GraphSwimlaneRepresentation | GraphArchitectureRepresentation;

export type GraphConfig = {
	version: number;
	containerDefault: GraphVisualStyle;
	containers: Record<string, GraphVisualStyle>;
	nodeDefault?: GraphVisualStyle;
	nodeChildDefault?: GraphVisualStyle;
	edgeDefault: GraphVisualStyle;
	activeHighlight?: { stroke?: string; strokeWidth?: number };
	swimlanes: GraphSwimlaneConfig[];
	representations?: GraphRepresentation[];
};

function swimlaneRepresentations(lanes: GraphSwimlaneConfig[]): GraphSwimlaneRepresentation[] {
	return lanes.map((lane) => ({
		kind: "swimlane",
		id: lane.id,
		label: lane.label,
		tags: lane.tags,
	}));
}

const graphConfigBase = graphConfigDocument as GraphConfig;

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
	...graphConfigBase,
	representations: graphConfigBase.representations?.length
		? graphConfigBase.representations
		: swimlaneRepresentations(graphConfigBase.swimlanes),
};

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
		representations:
			override.representations?.length
				? override.representations
				: DEFAULT_GRAPH_CONFIG.representations,
	};
}

/** Konfigurierte Bahnen plus Rest für Komponenten ohne passenden Tag. Der Rest ist keine eigene Bahn in den Settings. */
export function swimlanesWithRest(config: GraphConfig): GraphSwimlaneConfig[] {
	const rest = resolveUngroupedSwimlane(config);
	if (config.swimlanes.some((lane) => lane.id === rest.id)) {
		return config.swimlanes;
	}
	return [...config.swimlanes, rest];
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

export function graphText(value: unknown, lang: string = rootStore.i18n.lang): string {
	if (typeof value === "string") {
		return value;
	}
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return getLanguageText(value as Record<string, unknown>, lang);
	}
	return "";
}

export function presentPaint(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function presentId(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * XML-JSON: ein einzelnes Kind bleibt ein Objekt oder Text, mehrere Kinder werden zum Array.
 * `<tags><tag>bike</tag></tags>` wird damit zu `{ tag: "bike" }`, nicht zu `["bike"]`.
 */
export function xmlChildList(value: unknown, childName?: string): unknown[] {
	if (value == null || value === "") {
		return [];
	}
	if (Array.isArray(value)) {
		return value;
	}
	if (typeof value !== "object") {
		return [value];
	}
	const record = value as Record<string, unknown>;
	if (childName && Object.prototype.hasOwnProperty.call(record, childName)) {
		return xmlChildList(record[childName]);
	}
	return [value];
}

export function readTagStrings(value: unknown): string[] {
	const result: string[] = [];
	for (const entry of xmlChildList(value, "tag")) {
		if (typeof entry === "string" || typeof entry === "number") {
			const text = String(entry).trim();
			if (text) {
				result.push(text);
			}
			continue;
		}
		if (entry && typeof entry === "object" && "tag" in entry) {
			const inner = (entry as { tag: unknown }).tag;
			if (typeof inner === "string" || typeof inner === "number") {
				const text = String(inner).trim();
				if (text) {
					result.push(text);
				}
			}
		}
	}
	return result;
}

export function readPreviewMembers(
	value: unknown
): { id: string; label: GraphLocalizedText }[] {
	const members: { id: string; label: GraphLocalizedText }[] = [];
	for (const entry of xmlChildList(value, "member")) {
		if (!entry || typeof entry !== "object") {
			continue;
		}
		const member = entry as { id?: unknown; label?: unknown };
		const id = typeof member.id === "string" ? member.id.trim() : "";
		if (!id) {
			continue;
		}
		const label = member.label;
		members.push({
			id,
			label:
				typeof label === "string" || (label && typeof label === "object")
					? (label as GraphLocalizedText)
					: id,
		});
	}
	return members;
}

/** Hashtag-Vergleich: #database und database sind gleichwertig. */
export function normalizeHashtagForMatch(tag: string): string {
	return tag.trim().toLowerCase().replace(/^#+/, "").trim();
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

/** Catch-all für Elemente ohne passenden Hashtag. Fehlt die Bahn in den Settings, wird sie nur für die Ansicht ergänzt. */
export function resolveUngroupedSwimlane(config: GraphConfig): GraphSwimlaneConfig {
	return (
		config.swimlanes.find((lane) => lane.id === "ungrouped") ??
		config.swimlanes.find((lane) => lane.tags.length === 0) ?? {
			id: "ungrouped",
			label: { und: "Ungrouped", de: "Ungruppiert" },
			tags: [],
		}
	);
}
