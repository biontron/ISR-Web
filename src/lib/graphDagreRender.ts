import { Selection } from "d3-selection";
import * as dagreD3 from "dagre-d3-es";
import {
	createClusters,
	setCreateClusters,
} from "dagre-d3-es/src/dagre-js/create-clusters.js";
import { createEdgePaths } from "dagre-d3-es/src/dagre-js/create-edge-paths.js";
import { arrows } from "dagre-d3-es/src/dagre-js/arrows.js";
import { repairGraphClusterNodes } from "./graphDagreBuild";

/** Live-Export von dagre-d3-es — Referenz beim Modul-Laden festhalten. */
const dagreBuiltinCreateClusters = (() => createClusters)();

const FALLBACK_CLUSTER_STYLE = "fill:#f5f5f5; stroke:#333; stroke-width:1px;";

function isSubgraphNode(g: dagreD3.graphlib.Graph, nodeId: string): boolean {
	return (g.children(nodeId)?.length ?? 0) > 0;
}

function ensureClusterNodeData(g: dagreD3.graphlib.Graph, nodeId: string): void {
	const existing = g.node(nodeId);
	if (!existing || typeof existing !== "object") {
		g.setNode(nodeId, {
			labelType: "html",
			label: nodeId,
			clusterLabelPos: "top",
			style: FALLBACK_CLUSTER_STYLE,
			id: nodeId,
		});
		return;
	}
	if (!existing.style) {
		existing.style = FALLBACK_CLUSTER_STYLE;
	}
	if (!existing.id) {
		existing.id = nodeId;
	}
	if (!existing.label) {
		existing.label = nodeId;
	}
	if (!existing.labelType) {
		existing.labelType = "html";
	}
	if (!existing.clusterLabelPos) {
		existing.clusterLabelPos = "top";
	}
}

function safeCreateClusters(
	selection: Selection<SVGGElement, unknown, null, undefined>,
	g: dagreD3.graphlib.Graph
) {
	for (const nodeId of g.nodes()) {
		if (isSubgraphNode(g, nodeId)) {
			ensureClusterNodeData(g, nodeId);
		}
	}

	return dagreBuiltinCreateClusters(selection, g);
}

export function renderDagreGraph(
	svg: Selection<SVGSVGElement, unknown, null, undefined>,
	g: dagreD3.graphlib.Graph
) {
	repairGraphClusterNodes(g);
	setCreateClusters(safeCreateClusters);
	try {
		dagreD3.render()(svg, g);
	} finally {
		setCreateClusters(dagreBuiltinCreateClusters);
	}
}

function ensureGraphMargins(g: dagreD3.graphlib.Graph) {
	const graph = g.graph();
	if (graph.marginx == null) {
		graph.marginx = 20;
	}
	if (graph.marginy == null) {
		graph.marginy = 20;
	}
}

export function prepareGraphCanvas(
	svg: Selection<SVGSVGElement, unknown, null, undefined>,
	g: dagreD3.graphlib.Graph
) {
	ensureGraphMargins(g);
	svg.selectAll("g").remove();
}

/** Make HTML labels (foreignObject) and edge labels visible after dagre render. */
export function finalizeGraphLabels(
	svg: Selection<SVGSVGElement, unknown, null, undefined>
) {
	svg.selectAll("foreignObject div").style("color", "#111111").style("font-size", "13px");
	svg.selectAll("g.edgeLabel").style("opacity", 1).style("pointer-events", "all");
	svg.selectAll("g.edgeLabel .graph-link, g.edgeLabel .graph-edge-label").style(
		"color",
		"#0066cc"
	);
	svg.selectAll("g.node, g.cluster").style("opacity", 1);
}

type DagreGraph = dagreD3.graphlib.Graph;

/** Dagre-Knotenposition nach manuellem SVG-Layout synchronisieren (für Kanten-Anker). */
export function syncDagreNodeBox(
	graph: DagreGraph,
	nodeId: string,
	centerX: number,
	centerY: number,
	width: number,
	height: number
): void {
	const node = graph.node(nodeId) as { x?: number; y?: number; width?: number; height?: number } | undefined;
	if (!node || typeof node !== "object") {
		return;
	}
	node.x = centerX;
	node.y = centerY;
	node.width = width;
	node.height = height;
}

/** Kanten neu an aktuelle Knotenpositionen anbinden (nach Post-Render-Layout). */
export function rerouteDagreGraphEdges(
	svg: Selection<SVGSVGElement, unknown, null, undefined>,
	graph: DagreGraph
): void {
	const edgePaths = svg.select<SVGGElement>("g.output g.edgePaths");
	if (edgePaths.empty()) {
		return;
	}
	createEdgePaths(edgePaths, graph, arrows);
}

export function resolveGraphCanvasSize(
	svgElement: SVGSVGElement,
	viewportWidth: number
): { width: number; height: number } {
	const bbox = svgElement.getBBox();
	const marginX = 40;
	const marginY = 40;
	return {
		width: Math.max(bbox.width + marginX, viewportWidth, 400),
		height: Math.max(bbox.height + marginY, 300),
	};
}
