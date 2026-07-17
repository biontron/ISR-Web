/*
	========================================================================
	LICENSE AGREEMENT:
	...
========================================================================
*/

import { Button } from "antd";
import { useCallback, useEffect, useRef, useState, Fragment } from "react";
import { observer } from "mobx-react";
import { rootStore } from "../../../Stores/Root.Store";
import authStore from "../../../Stores/Auth.Store";
import { ActiveElement, isTreeElement, TreeElement } from "../../../Interfaces/Element";
import { select, Selection } from "d3-selection";
import * as dagreD3 from "dagre-d3-es";
import { useNavigate } from "react-router-dom";
import ConnectionDialog from "../../../Components/Connections/ConnectionDialog";
import {
	collectConnectionGraphEdges,
	collectConnectionGraphEdgesFromTree,
	collectVisibleAssetIdsFromTree,
	mergeConnectionGraphEdges,
} from "../../../lib/graphConnectionEdges";
import {
	addConnectionEdgesToGraph,
	addMapPositionedNodes,
	addTreeNodesToGraph,
	buildSwimlaneGraph,
	repairGraphClusterNodes,
} from "../../../lib/graphDagreBuild";
import { prepareGraphCanvas, renderDagreGraph, finalizeGraphLabels, resolveGraphCanvasSize } from "../../../lib/graphDagreRender";
import { resolveEdgeStyle, readElementGraphPosition } from "../../../lib/graphElementStyle";
import { GraphConfig } from "../../../lib/graphConfig";
import { resolveGraphConfigForView } from "../../../lib/graphViewModel";
import {
	applySwimlaneFullWidthLayout,
	resolveSwimlaneGraphCanvasSize,
} from "../../../lib/graphSwimlaneRender";
import { applyGraphAssetStackLayout } from "../../../lib/graphComponentStackLayout";
import { appendGraphArrowDefs, applyEdgeStylesToSvg } from "../../../lib/graphSvgEdges";

function getNodeIdFromDatum(d: unknown): string | undefined {
	if (typeof d === "string") return d;
	if (d && typeof d === "object" && "id" in d) return String((d as { id: string }).id);
	return undefined;
}

const GRAPH_INLINE_STYLE = `
	.label svg { height:2em; max-height:2em; width:2em; max-width:2em; display:inline-block; vertical-align:top; flex:0 0 auto; }
	.label .Label { display:flex; align-items:flex-start; gap:6px; }
	.label .graph-icon { display:inline-flex; flex:0 0 auto; }
	.label .graph-link { display:inline-block; min-width:0; }
	.graph-link { cursor: pointer; color: #111; }
	.graph-link:hover { text-decoration: underline; color: #0066cc; }
	.graph-swimlane-title { font-weight: 600; padding: 0 2px 4px; color: #111; text-align: left; white-space: nowrap; }
	svg .edgePath.graph-edge--swimlane-hidden { display: none; }
	svg foreignObject { overflow: visible; }
	svg .edgeLabel { pointer-events: all; }
	.graph-node-shell { position: relative; display: inline-block; }
	.graph-node-tooltip {
		display: none;
		position: absolute;
		left: 0;
		bottom: calc(100% + 8px);
		z-index: 20;
		min-width: 240px;
		max-width: 360px;
		padding: 8px 10px;
		background: #fff;
		border: 1px solid #d9d9d9;
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
		pointer-events: none;
		text-align: left;
		white-space: normal;
	}
	.graph-node-shell:hover .graph-node-tooltip { display: block; }
	.graph-node-tooltip__title { font-weight: 600; margin-bottom: 6px; }
	.graph-node-tooltip__table { width: 100%; border-collapse: collapse; font-size: 12px; }
	.graph-node-tooltip__table th,
	.graph-node-tooltip__table td {
		border: 1px solid #f0f0f0;
		padding: 2px 6px;
		vertical-align: top;
	}
	.graph-node-tooltip__table th {
		width: 34%;
		background: #fafafa;
		font-weight: 600;
	}
	.graph-canvas__viewport { overflow: auto; width: 100%; min-height: 320px; min-width: 0; }
	.graph-canvas__svg { display: block; min-width: 100%; background-color: #f2f2f2; }
`;

type GraphRenderOptions = {
	rankdir?: "TB" | "LR";
	ranksep?: number;
	nodesep?: number;
};

function collectGraphEdges(root: TreeElement) {
	const assets = rootStore.assets.assets.slice();
	const connections = rootStore.connections.connections.slice();
	const visibleIds = collectVisibleAssetIdsFromTree(root, 10);
	return mergeConnectionGraphEdges(
		collectConnectionGraphEdges(assets, connections, visibleIds),
		collectConnectionGraphEdgesFromTree(root, assets, connections, 10)
	);
}

function useGraphZoom() {
	const [zoomLevel, setZoomLevel] = useState(1);
	return {
		zoomLevel,
		zoomIn: () => setZoomLevel((value) => value * 1.2),
		zoomOut: () => setZoomLevel((value) => value / 1.2),
	};
}

function bindNodeNavigation(
	svg: Selection<SVGSVGElement, unknown, null, undefined>,
	navigate: ReturnType<typeof useNavigate>
) {
	svg.selectAll("g.cluster .graph-link, g.node .graph-link").on("click", function (event: Event) {
		event.stopPropagation();
		event.preventDefault();
		const closest = (event.currentTarget as Element).closest("g.node, g.cluster");
		if (!closest) {
			return;
		}
		const nodeId = getNodeIdFromDatum(select(closest).datum());
		if (nodeId) {
			const domain = authStore.getDomain();
			const currentViewId = rootStore.ui.activeView?.id ?? "";
			navigate(`/${domain}/am/${currentViewId}/element/${nodeId}`);
		}
	});
}

function bindEdgeOpenConnection(
	svg: Selection<SVGSVGElement, unknown, null, undefined>,
	onOpenConnection: (connectionId: string) => void
) {
	svg.selectAll("g.edgePath").on("click", function (event: Event) {
		event.stopPropagation();
		event.preventDefault();
		const labelSpan = (event.currentTarget as Element).querySelector("[data-connection-id]");
		const connectionId = labelSpan?.getAttribute("data-connection-id");
		if (connectionId) {
			onOpenConnection(connectionId);
		}
	});
}

type GraphCanvasProps = {
	element: ActiveElement;
	layout: GraphRenderOptions;
	canvasClassName?: string;
	buildGraph: (
		g: dagreD3.graphlib.Graph,
		root: TreeElement,
		config: GraphConfig
	) => ReturnType<typeof collectConnectionGraphEdges>;
	postRender?: (
		svg: Selection<SVGSVGElement, unknown, null, undefined>,
		root: TreeElement,
		graphConfig: GraphConfig,
		viewportWidth: number,
		dagreGraph: dagreD3.graphlib.Graph
	) => number | undefined;
	resolveCanvasSize?: (
		svgElement: SVGSVGElement,
		viewportWidth: number,
		layoutHeight?: number
	) => { width: number; height: number };
};

const GraphCanvas = observer(
	({ element, layout, canvasClassName, buildGraph, postRender, resolveCanvasSize }: GraphCanvasProps) => {
		const graphContainer = useRef<SVGSVGElement>(null);
		const { zoomLevel, zoomIn, zoomOut } = useGraphZoom();
		const navigate = useNavigate();
		const [connectionDialogId, setConnectionDialogId] = useState<string | null>(null);

		const renderGraph = useCallback(() => {
			const view = rootStore.ui.activeView;
			if (!view || !element || !isTreeElement(element) || !graphContainer.current) {
				return;
			}

			const graphRoot = element as TreeElement;
			const graphConfig = resolveGraphConfigForView(view.settings);
			const g = new dagreD3.graphlib.Graph({ compound: true, directed: true });
			g.setDefaultEdgeLabel(() => ({ label: "" }));
			g.setGraph({});
			g.graph().rankdir = layout.rankdir ?? "TB";
			g.graph().ranksep = layout.ranksep ?? 70;
			g.graph().nodesep = layout.nodesep ?? 5;
			g.graph().marginx = 20;
			g.graph().marginy = 20;

			const edges = buildGraph(g, graphRoot, graphConfig);
			repairGraphClusterNodes(g);

			const svg = select(graphContainer.current);
			prepareGraphCanvas(svg, g);
			renderDagreGraph(svg, g);
			finalizeGraphLabels(svg);

			appendGraphArrowDefs(svg);
			applyEdgeStylesToSvg(svg, resolveEdgeStyle(graphConfig), edges);
			svg
				.selectAll<SVGPathElement, unknown>("g.edgePath path")
				.style("stroke", resolveEdgeStyle(graphConfig).lineColor ?? "#555555")
				.style("stroke-width", `${resolveEdgeStyle(graphConfig).lineWidth ?? 1.5}px`)
				.style("fill", "none")
				.style("stroke-opacity", String(resolveEdgeStyle(graphConfig).lineOpacity ?? 0.7));
			bindNodeNavigation(svg, navigate);
			bindEdgeOpenConnection(svg, setConnectionDialogId);

			const viewportWidth =
				graphContainer.current.parentElement?.clientWidth ?? 0;

			const layoutHeight = postRender?.(svg, graphRoot, graphConfig, viewportWidth, g);

			if (svg.node()) {
				const { width, height } = resolveCanvasSize
					? resolveCanvasSize(svg.node()!, viewportWidth, layoutHeight)
					: resolveGraphCanvasSize(svg.node()!, viewportWidth);
				svg.attr("width", width).attr("height", height);
			}

			const inner = graphContainer.current.querySelector("g");
			if (inner) {
				inner.setAttribute("transform", `translate(0,0) scale(${zoomLevel})`);
			}
		}, [element, layout.rankdir, layout.ranksep, layout.nodesep, buildGraph, navigate, zoomLevel, postRender, resolveCanvasSize]);

		useEffect(() => {
			renderGraph();
			return () => {
				if (graphContainer.current) {
					select(graphContainer.current).selectAll("g.node, g.cluster, g.edgePath").on("click", null);
				}
			};
		}, [renderGraph]);

		return (
			<div className={["graph-canvas", canvasClassName].filter(Boolean).join(" ")}>
				<div style={{ marginBottom: 8 }}>
					<Button type="primary" onClick={zoomIn} style={{ marginRight: 8 }}>+</Button>
					<Button type="primary" onClick={zoomOut}>-</Button>
				</div>
				<div className="graph-canvas__viewport">
					<svg ref={graphContainer} className="graph-canvas__svg">
						<style>{GRAPH_INLINE_STYLE}</style>
					</svg>
				</div>
				<ConnectionDialog connectionId={connectionDialogId} onClose={() => setConnectionDialogId(null)} />
			</div>
		);
	}
);

export const ElementGraphOverview = observer(({ element }: { element: ActiveElement }) => (
	<GraphCanvas
		element={element}
		layout={{ rankdir: "TB", ranksep: 70, nodesep: 5 }}
		buildGraph={(g, root, config) => {
			addTreeNodesToGraph(g, {
				depth: 10,
				parentId: root.id,
				root,
				activeElementId: rootStore.ui.activeElement?.id,
				config,
			});
			const edges = collectGraphEdges(root);
			addConnectionEdgesToGraph(g, edges);
			return edges;
		}}
		postRender={(svg, _root, graphConfig, viewportWidth, dagreGraph) => {
			applyGraphAssetStackLayout(svg, dagreGraph);
			return undefined;
		}}
	/>
));

export const ElementGraphSwimlanes = observer(({ element }: { element: ActiveElement }) => (
	<GraphCanvas
		element={element}
		canvasClassName="graph-canvas--swimlanes"
		layout={{ rankdir: "TB", ranksep: 80, nodesep: 40 }}
		buildGraph={(g, _root, config) => {
			const view = rootStore.ui.activeView;
			if (!view) {
				return [];
			}
			const viewRoot = view as TreeElement;
			buildSwimlaneGraph(g, viewRoot, config, rootStore.ui.activeElement?.id);
			return [];
		}}
		postRender={(svg, _root, graphConfig, viewportWidth, dagreGraph) =>
			applySwimlaneFullWidthLayout(
				svg,
				graphConfig,
				viewportWidth,
				rootStore.i18n.lang,
				dagreGraph
			)
		}
		resolveCanvasSize={(_svg, viewportWidth, layoutHeight) =>
			resolveSwimlaneGraphCanvasSize(layoutHeight ?? 300, viewportWidth)
		}
	/>
));

export const ElementGraphMap = observer(({ element }: { element: ActiveElement }) => {
	const flatNodesRef = useRef<TreeElement[]>([]);

	return (
		<GraphCanvas
			element={element}
			layout={{ rankdir: "TB", ranksep: 20, nodesep: 20 }}
			buildGraph={(g, root, config) => {
				const flatNodes: TreeElement[] = [];
				const walk = (node: TreeElement, depth: number) => {
					if (!node?.definition) {
						return;
					}
					flatNodes.push(node);
					if (depth <= 0 || typeof node.children !== "function") {
						return;
					}
					for (const child of node.children()) {
						if (child) {
							walk(child as TreeElement, depth - 1);
						}
					}
				};
				walk(root, 10);
				flatNodesRef.current = flatNodes;
				addMapPositionedNodes(g, flatNodes, rootStore.ui.activeElement?.id, config);
				const visibleIds = new Set(
					flatNodes.filter((node) => node.class === "Asset").map((node) => node.id)
				);
				const edges = mergeConnectionGraphEdges(
					collectConnectionGraphEdges(
						rootStore.assets.assets.slice(),
						rootStore.connections.connections.slice(),
						visibleIds
					),
					collectConnectionGraphEdgesFromTree(
						root,
						rootStore.assets.assets.slice(),
						rootStore.connections.connections.slice(),
						10
					)
				);
				addConnectionEdgesToGraph(g, edges);
				return edges;
			}}
			postRender={(svg) => {
				flatNodesRef.current.forEach((node, index) => {
					const pos = readElementGraphPosition(node) ?? {
						x: 40 + (index % 5) * 140,
						y: 40 + Math.floor(index / 5) * 100,
					};
					svg.selectAll("g.node").each(function (datum) {
						const nodeId = typeof datum === "string" ? datum : "";
						if (nodeId !== node.id) {
							return;
						}
						const group = select(this);
						const current = group.attr("transform") ?? "";
						const scaleMatch = /scale\(([^)]+)\)/.exec(current);
						const scaleSuffix = scaleMatch ? ` scale(${scaleMatch[1]})` : "";
						group.attr("transform", `translate(${pos.x},${pos.y})${scaleSuffix}`);
					});
				});
				return undefined;
			}}
		/>
	);
});

/** @deprecated Test stub — use ElementGraphOverview */
export const ElementGraphLayered = ElementGraphOverview;
/** @deprecated Test stub */
export const ElementGraphTest = ElementGraphOverview;
/** @deprecated Test stub */
export const ElementGraphTest2 = ElementGraphOverview;
