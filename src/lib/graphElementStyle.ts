import { getSnapshot } from "mobx-state-tree";
import {
	GraphConfig,
	GraphVisualStyle,
	loadGraphConfig,
	resolveContainerPreset,
} from "./graphConfig";

export type GraphStyleElementLike = {
	class?: string;
	id?: string;
	ownerIdRef?: string | null;
	definition?: {
		tags?: unknown;
		baseType?: string;
		subType?: string;
		name?: string;
	};
	properties?: {
		style?: {
			bgColor?: string | null;
			graph?: {
				layout?: string | null;
				style?: GraphVisualStyle | null;
			};
		};
	};
	settings?: { get?: (key: string) => unknown } | Map<string, unknown> | Record<string, unknown>;
};

export const GRAPH_STYLE_TECHNICAL_DEFAULTS: GraphVisualStyle = {
	fill: "#f5f5f5",
	fillOpacity: 1,
	stroke: "#333333",
	strokeWidth: 1,
	strokeDasharray: "",
	labelColor: "#000000",
};

function readSettingsGraph(element: GraphStyleElementLike): Record<string, unknown> {
	const settings = element.settings;
	if (!settings) {
		return {};
	}
	if (settings instanceof Map) {
		const graph = settings.get("graph");
		return graph && typeof graph === "object" ? (graph as Record<string, unknown>) : {};
	}
	if (typeof (settings as { get?: (key: string) => unknown }).get === "function") {
		const graph = (settings as { get: (key: string) => unknown }).get("graph");
		return graph && typeof graph === "object" ? (graph as Record<string, unknown>) : {};
	}
	const graph = (settings as Record<string, unknown>).graph;
	return graph && typeof graph === "object" ? (graph as Record<string, unknown>) : {};
}

function readStyleOverride(source: unknown): GraphVisualStyle {
	if (!source || typeof source !== "object") {
		return {};
	}
	return source as GraphVisualStyle;
}

function mergeGraphStyles(...layers: GraphVisualStyle[]): GraphVisualStyle {
	const result: GraphVisualStyle = { ...GRAPH_STYLE_TECHNICAL_DEFAULTS };
	for (const layer of layers) {
		for (const [key, value] of Object.entries(layer)) {
			if (value !== undefined && value !== null && value !== "") {
				(result as Record<string, unknown>)[key] = value;
			}
		}
	}
	return result;
}

function legacyBgColorFill(element: GraphStyleElementLike): GraphVisualStyle {
	const bgColor = element.properties?.style?.bgColor;
	if (bgColor == null || bgColor === "") {
		return {};
	}
	return { fill: String(bgColor) };
}

function basePresetForElement(
	element: GraphStyleElementLike,
	config: GraphConfig,
	isActive: boolean
): GraphVisualStyle {
	if (element.class === "View" || element.class === "Group") {
		return resolveContainerPreset(config, element.properties?.style?.graph?.layout);
	}
	if (element.class === "Asset" || element.class === "AssetDetails") {
		const hasOwner =
			"ownerIdRef" in element &&
			element.ownerIdRef != null &&
			String(element.ownerIdRef).trim() !== "";
		if (isActive) {
			return { fill: "orange", ...(config.nodeDefault ?? {}) };
		}
		return hasOwner
			? (config.nodeChildDefault ?? config.nodeDefault ?? {})
			: (config.nodeDefault ?? {});
	}
	return config.containerDefault;
}

function normalizeTagList(value: unknown): string[] {
	if (value == null) {
		return [];
	}
	if (Array.isArray(value)) {
		return value
			.map((entry) => {
				if (typeof entry === "string") {
					return entry;
				}
				if (entry && typeof entry === "object" && "tag" in entry) {
					return String((entry as { tag: unknown }).tag ?? "");
				}
				return "";
			})
			.filter((tag) => tag.trim() !== "");
	}
	if (typeof value === "object") {
		const record = value as Record<string, unknown>;
		if ("tag" in record) {
			const tag = String(record.tag ?? "");
			return tag.trim() !== "" ? [tag] : [];
		}
	}
	return [];
}

function readDefinitionTags(element: GraphStyleElementLike): string[] {
	if (element.definition?.tags != null) {
		return normalizeTagList(element.definition.tags);
	}
	try {
		const snapshot = getSnapshot(element as Parameters<typeof getSnapshot>[0]);
		if (snapshot && typeof snapshot === "object" && "definition" in snapshot) {
			const definition = (snapshot as { definition?: { tags?: unknown } }).definition;
			return normalizeTagList(definition?.tags);
		}
	} catch {
		// not an MST node — ignore
	}
	return [];
}

export function readElementGraphTags(element: GraphStyleElementLike): string[] {
	const fromDefinition = readDefinitionTags(element);
	const fromSettings = normalizeTagList(readSettingsGraph(element).tags);
	const seen = new Set<string>();
	return [...fromDefinition, ...fromSettings].filter((tag) => {
		const key = tag.toLowerCase();
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

export function readElementGraphPosition(
	element: GraphStyleElementLike
): { x: number; y: number } | null {
	const settingsGraph = readSettingsGraph(element);
	const position = settingsGraph.position;
	if (!position || typeof position !== "object") {
		return null;
	}
	const record = position as Record<string, unknown>;
	const x = Number(record.x);
	const y = Number(record.y);
	if (!Number.isFinite(x) || !Number.isFinite(y)) {
		return null;
	}
	return { x, y };
}

export function resolveGraphStyle(
	element: GraphStyleElementLike,
	options?: {
		config?: GraphConfig;
		isActive?: boolean;
		schemaDefault?: GraphVisualStyle;
	}
): GraphVisualStyle {
	const config = options?.config ?? loadGraphConfig();
	const isActive = options?.isActive ?? false;
	const settingsGraph = readSettingsGraph(element);

	const merged = mergeGraphStyles(
		basePresetForElement(element, config, isActive),
		options?.schemaDefault ?? {},
		readStyleOverride(element.properties?.style?.graph?.style),
		legacyBgColorFill(element),
		readStyleOverride(settingsGraph.style)
	);

	if (isActive && config.activeHighlight) {
		merged.stroke = config.activeHighlight.stroke ?? merged.stroke;
		merged.strokeWidth = config.activeHighlight.strokeWidth ?? merged.strokeWidth;
	}

	return merged;
}

export function resolveEdgeStyle(config?: GraphConfig): GraphVisualStyle {
	const graphConfig = config ?? loadGraphConfig();
	return mergeGraphStyles(GRAPH_STYLE_TECHNICAL_DEFAULTS, {
		lineColor: graphConfig.edgeDefault.lineColor,
		lineWidth: graphConfig.edgeDefault.lineWidth,
		lineOpacity: graphConfig.edgeDefault.lineOpacity,
		lineDasharray: graphConfig.edgeDefault.lineDasharray,
	});
}

export function graphStyleToSvgNodeStyle(style: GraphVisualStyle): string {
	const fillOpacity =
		style.fillOpacity != null && style.fillOpacity < 1
			? ` fill-opacity:${style.fillOpacity};`
			: "";
	const dash =
		style.strokeDasharray && style.strokeDasharray !== ""
			? ` stroke-dasharray:${style.strokeDasharray};`
			: "";
	return `fill: ${style.fill ?? GRAPH_STYLE_TECHNICAL_DEFAULTS.fill}; stroke:${style.stroke ?? GRAPH_STYLE_TECHNICAL_DEFAULTS.stroke}; stroke-width:${style.strokeWidth ?? 1}px;${dash}${fillOpacity}`;
}

export function graphStyleToSvgEdgeStyle(style: GraphVisualStyle): Record<string, string> {
	return {
		stroke: style.lineColor ?? "#555555",
		"stroke-width": `${style.lineWidth ?? 1.5}px`,
		fill: "none",
		"stroke-opacity": String(style.lineOpacity ?? 0.7),
		...(style.lineDasharray ? { "stroke-dasharray": style.lineDasharray } : {}),
	};
}
