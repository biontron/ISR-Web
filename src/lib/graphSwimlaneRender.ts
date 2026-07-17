import { select, Selection } from "d3-selection";
import * as dagreD3 from "dagre-d3-es";
import { GraphConfig, resolveSwimlaneLabel } from "./graphConfig";
import { layoutSwimlaneStackNodes } from "./graphComponentStackLayout";
import { SWIMLANE_GRAPH_ROOT_ID } from "./graphDagreBuild";
import { swimlaneNodeId } from "./graphSwimlaneLayout";
import { readGraphNodeId } from "./graphNodeMeasure";

type DagreGraph = dagreD3.graphlib.Graph;

const LANE_PAD_X = 16;
const LANE_PAD_Y = 16;
const LANE_GAP = 16;
const LANE_TITLE_HEIGHT = 22;
const LANE_TITLE_GAP = 4;
const LANE_MIN_BODY_HEIGHT = 88;

function appendLaneTitle(
	inner: Selection<SVGGElement, unknown, null, undefined>,
	title: string,
	x: number,
	y: number,
	width: number
) {
	const fo = inner
		.append("foreignObject")
		.attr("class", "graph-swimlane-title-bar")
		.attr("x", x)
		.attr("y", y)
		.attr("width", width)
		.attr("height", LANE_TITLE_HEIGHT);

	fo.append("xhtml:div")
		.attr("xmlns", "http://www.w3.org/1999/xhtml")
		.attr("class", "graph-swimlane-title")
		.text(title);
}

/** Volle Breite + Titel links oberhalb jeder Swimlane (nach dagre-Render). */
export function applySwimlaneFullWidthLayout(
	svg: Selection<SVGSVGElement, unknown, null, undefined>,
	config: GraphConfig,
	viewportWidth: number,
	lang?: string,
	graph?: DagreGraph
): number {
	const contentWidth = Math.max(viewportWidth - LANE_PAD_X * 2, 320);
	const inner = svg.select<SVGGElement>("g.output");
	const rootInner = inner.empty() ? svg.select<SVGGElement>("g") : inner;
	if (rootInner.empty()) {
		return LANE_PAD_Y * 2;
	}

	rootInner.selectAll(".graph-swimlane-title-bar").remove();

	rootInner.selectAll<SVGGElement, unknown>("g.cluster").each(function () {
		const id = readGraphNodeId(this) ?? this.getAttribute("id");
		if (id === SWIMLANE_GRAPH_ROOT_ID) {
			select(this).style("display", "none");
			return;
		}
		if (id?.startsWith("__lane__")) {
			select(this).select("g.label").remove();
		}
	});

	let y = LANE_PAD_Y;

	for (const lane of config.swimlanes) {
		const laneId = swimlaneNodeId(lane.id);
		const laneG = rootInner.selectAll<SVGGElement, unknown>("g.cluster").filter(function () {
			return (readGraphNodeId(this) ?? this.getAttribute("id")) === laneId;
		});
		if (laneG.empty()) {
			continue;
		}

		laneG.select("g.label").remove();

		const title = resolveSwimlaneLabel(lane, lang);
		appendLaneTitle(rootInner, title, LANE_PAD_X, y, contentWidth);

		const laneTop = y + LANE_TITLE_HEIGHT + LANE_TITLE_GAP;
		const bodyHeight =
			graph != null
				? layoutSwimlaneStackNodes(svg, graph, laneId, LANE_PAD_X, laneTop, contentWidth)
				: LANE_MIN_BODY_HEIGHT;

		laneG.attr("transform", `translate(${LANE_PAD_X},${laneTop})`);
		laneG
			.select("rect")
			.attr("x", 0)
			.attr("y", 0)
			.attr("width", contentWidth)
			.attr("height", Math.max(bodyHeight, LANE_MIN_BODY_HEIGHT));
		laneG.style("clip-path", "none");

		y = laneTop + Math.max(bodyHeight, LANE_MIN_BODY_HEIGHT) + LANE_GAP;
	}

	return y + LANE_PAD_Y;
}

export function resolveSwimlaneGraphCanvasSize(
	layoutHeight: number,
	viewportWidth: number
): { width: number; height: number } {
	return {
		width: Math.max(viewportWidth, 400),
		height: Math.max(layoutHeight, 300),
	};
}
