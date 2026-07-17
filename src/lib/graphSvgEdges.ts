import { Selection } from "d3-selection";
import {
	resolveConnectionDirection,
	resolveConnectionDirectionMarkers,
} from "./connectionDirection";
import { ConnectionGraphEdge } from "./graphConnectionEdges";
import { GraphVisualStyle } from "./graphConfig";
import {
	graphStyleToSvgEdgeStyle,
} from "./graphElementStyle";

export const GRAPH_ARROW_START_ID = "graph-arrow-start";
export const GRAPH_ARROW_END_ID = "graph-arrow-end";

export function appendGraphArrowDefs(
	svg: Selection<SVGSVGElement, unknown, null, undefined>
) {
	const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
	if (defs.select(`#${GRAPH_ARROW_START_ID}`).empty()) {
		defs
			.append("marker")
			.attr("id", GRAPH_ARROW_START_ID)
			.attr("markerWidth", 8)
			.attr("markerHeight", 8)
			.attr("refX", 0)
			.attr("refY", 3)
			.attr("orient", "auto")
			.attr("markerUnits", "strokeWidth")
			.append("path")
			.attr("d", "M6,0 L6,6 L0,3 z")
			.attr("fill", "#555555");
	}
	if (defs.select(`#${GRAPH_ARROW_END_ID}`).empty()) {
		defs
			.append("marker")
			.attr("id", GRAPH_ARROW_END_ID)
			.attr("markerWidth", 8)
			.attr("markerHeight", 8)
			.attr("refX", 6)
			.attr("refY", 3)
			.attr("orient", "auto")
			.attr("markerUnits", "strokeWidth")
			.append("path")
			.attr("d", "M0,0 L0,6 L6,3 z")
			.attr("fill", "#555555");
	}
}

export function applyEdgeStylesToSvg(
	svg: Selection<SVGSVGElement, unknown, null, undefined>,
	edgeStyle: GraphVisualStyle,
	edges: ConnectionGraphEdge[]
) {
	const styles = graphStyleToSvgEdgeStyle(edgeStyle);
	const edgeByConnectionId = new Map(edges.map((edge) => [edge.connectionId, edge]));

	svg.selectAll<SVGPathElement, unknown>("g.edgePath path").each(function () {
		const path = this;
		const edgeGroup = path.closest("g.edgePath");
		const labelSpan = edgeGroup?.querySelector("[data-connection-id]");
		const connectionId = labelSpan?.getAttribute("data-connection-id") ?? "";
		const edge = edgeByConnectionId.get(connectionId);
		const direction = resolveConnectionDirection(edge?.direction);
		const markers = resolveConnectionDirectionMarkers(
			direction,
			GRAPH_ARROW_START_ID,
			GRAPH_ARROW_END_ID
		);

		for (const [key, value] of Object.entries(styles)) {
			path.style.setProperty(key, value);
		}
		if (markers.strokeDasharray) {
			path.style.setProperty("stroke-dasharray", markers.strokeDasharray);
		}
		if (markers.markerStart) {
			path.setAttribute("marker-start", markers.markerStart);
		} else {
			path.removeAttribute("marker-start");
		}
		if (markers.markerEnd) {
			path.setAttribute("marker-end", markers.markerEnd);
		} else {
			path.removeAttribute("marker-end");
		}
		path.style.cursor = "pointer";
		path.classList.add("graph-connection-edge");
	});
}
