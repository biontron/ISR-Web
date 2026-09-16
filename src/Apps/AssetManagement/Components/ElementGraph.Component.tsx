/*
	========================================================================
	LICENSE AGREEMENT:
	...
========================================================================
*/

import { Button } from "antd";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, Fragment } from "react";
import { createPortal } from "react-dom";
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
	collectRenderedGraphNodeIds,
	collectVisibleAssetIdsFromTree,
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
import { applyOverviewClusterLayout } from "../../../lib/graphOverviewRender";
import { isStackMemberAsset } from "../../../lib/graphComponentStack";
import { appendGraphArrowDefs, applyEdgeStylesToSvg } from "../../../lib/graphSvgEdges";
import {
	hierarchyAssignmentEpoch,
	hierarchyOwnerEpoch,
	hierarchyStatusEpoch,
} from "../../../lib/hierarchyIndex";
import { placeFixedHoverOverlay, resolveGraphNodeHoverFields } from "../../../lib/graphNodeHover";
import { ElementDefinitionHoverContent } from "../../../Components/Schema/ElementDefinitionHoverTooltip";

function getNodeIdFromDatum(d: unknown): string | undefined {
	if (typeof d === "string") return d;
	if (d && typeof d === "object" && "id" in d) return String((d as { id: string }).id);
	return undefined;
}

const GRAPH_INLINE_STYLE = `
	.label svg { height:2em; max-height:2em; width:2em; max-width:2em; display:inline-block; vertical-align:top; flex:0 0 auto; }
	.label .Label { display:flex; align-items:flex-start; gap:6px; }
	.label .graph-icon { display:inline-flex; flex:0 0 auto; }
	.label .graph-link { display:inline-block; min-width:max-content; white-space:nowrap; }
	.graph-cluster-label { font-size: 14.3px; font-weight: 700; white-space:nowrap; }
	.graph-cluster-label .graph-link { font-weight: 700; white-space:nowrap; min-width:max-content; flex:0 0 auto; }
	g.cluster .graph-node-shell { padding-right: 0; width: max-content; }
	.graph-link { cursor: pointer; color: #111; }
	.graph-link:hover { text-decoration: underline; color: #0066cc; }
	.graph-swimlane-title { font-weight: 600; padding: 0 2px 4px; color: #111; text-align: left; white-space: nowrap; }
	svg .edgePath.graph-edge--swimlane-hidden,
	svg .edgePath.graph-edge--layout-hidden,
	svg .edgeLabel.graph-edge--layout-hidden { display: none; }
	svg .node.graph-overview-rank-dummy { display: none; }
	svg foreignObject { overflow: visible; }
	svg .edgeLabel { pointer-events: all; }
	.graph-node-shell { position: relative; display: inline-block; padding-right: 22px; text-align: left; overflow: visible; }
	g.cluster, g.node { overflow: visible; }
	g.graph-device-shell > g.label .graph-node-shell {
		width: auto;
		max-width: 100%;
		box-sizing: border-box;
		background: transparent;
		padding: 0;
		text-align: left;
	}
	g.graph-device-shell rect.graph-device-titlebar,
	g.graph-nested-component rect.graph-nested-titlebar { fill: rgba(255,255,255,0.3); }
	g.graph-nested-component > g.label .graph-node-shell {
		width: auto;
		text-align: left;
	}
	.graph-canvas__viewport { overflow: auto; width: 100%; min-height: 320px; min-width: 0; }
	.graph-canvas__svg { display: block; min-width: 100%; }
`;

type GraphRenderOptions = {
	rankdir?: "TB" | "LR";
	ranksep?: number;
	nodesep?: number;
};

function collectGraphEdges(root: TreeElement, renderedNodeIds?: Set<string>) {
	const assets = Array.from(rootStore.assets.assets);
	const connections = Array.from(rootStore.connections.connections);
	const visibleIds =
		renderedNodeIds && renderedNodeIds.size > 0
			? renderedNodeIds
			: collectVisibleAssetIdsFromTree(root, 2);
	return collectConnectionGraphEdges(assets, connections, visibleIds);
}

export function useGraphZoom() {
	const [zoomLevel, setZoomLevel] = useState(1);
	return {
		zoomLevel,
		zoomIn: () => setZoomLevel((value) => value * 1.2),
		zoomOut: () => setZoomLevel((value) => value / 1.2),
	};
}

export function GraphZoomButtons({
	zoomIn,
	zoomOut,
}: {
	zoomIn: () => void;
	zoomOut: () => void;
}) {
	return (
		<div className="graph-zoom-buttons">
			<Button type="primary" size="small" onClick={zoomIn}>
				+
			</Button>
			<Button type="primary" size="small" onClick={zoomOut}>
				-
			</Button>
		</div>
	);
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

type GraphNodeHoverState = {
	nodeId: string;
	rect: DOMRect;
};

const GRAPH_HOVER_DELAY_MS = 200;
const GRAPH_HOVER_ESTIMATE = { width: 320, height: 280 };

function bindNodeHover(
	svg: Selection<SVGSVGElement, unknown, null, undefined>,
	onHover: (next: GraphNodeHoverState | null) => void
) {
	let hoverTimer: number | undefined;
	const shells = svg.selectAll<HTMLElement, unknown>("g.cluster .graph-node-shell, g.node .graph-node-shell");
	shells.on("mouseenter.hover", function (event: Event) {
		window.clearTimeout(hoverTimer);
		const closest = (event.currentTarget as Element).closest("g.node, g.cluster");
		if (!closest) {
			return;
		}
		const nodeId = getNodeIdFromDatum(select(closest).datum());
		const rect = (event.currentTarget as Element).getBoundingClientRect();
		if (!nodeId) {
			return;
		}
		hoverTimer = window.setTimeout(() => {
			onHover({ nodeId, rect });
		}, GRAPH_HOVER_DELAY_MS);
	});
	shells.on("mouseleave.hover", function (event: Event) {
		const related = event instanceof MouseEvent ? event.relatedTarget : null;
		const relatedEl = related instanceof Element ? related : related instanceof Node ? related.parentElement : null;
		if (relatedEl?.closest(".graph-node-shell") && svg.node()?.contains(relatedEl.closest(".graph-node-shell"))) {
			return;
		}
		window.clearTimeout(hoverTimer);
		onHover(null);
	});
	return () => window.clearTimeout(hoverTimer);
}

function GraphNodeHoverOverlay({ hover }: { hover: GraphNodeHoverState | null }) {
	const overlayRef = useRef<HTMLDivElement>(null);
	const fields = hover ? resolveGraphNodeHoverFields(rootStore, hover.nodeId) : undefined;
	const estimate = hover
		? placeFixedHoverOverlay({
				anchor: hover.rect,
				overlay: GRAPH_HOVER_ESTIMATE,
				viewport: { width: window.innerWidth, height: window.innerHeight },
			})
		: { left: 0, top: 0 };

	useLayoutEffect(() => {
		const el = overlayRef.current;
		if (!el || !hover) {
			return;
		}
		const box = el.getBoundingClientRect();
		const next = placeFixedHoverOverlay({
			anchor: hover.rect,
			overlay: { width: box.width, height: box.height },
			viewport: { width: window.innerWidth, height: window.innerHeight },
		});
		el.style.left = `${next.left}px`;
		el.style.top = `${next.top}px`;
		el.style.visibility = "visible";
	}, [hover]);

	if (!hover || !fields) {
		return null;
	}

	return createPortal(
		<div
			ref={overlayRef}
			className="graph-hover-overlay"
			style={{ left: estimate.left, top: estimate.top, visibility: "hidden" }}
		>
			<ElementDefinitionHoverContent fields={fields} />
		</div>,
		document.body
	);
}

type GraphCanvasProps = {
	element: ActiveElement;
	layout: GraphRenderOptions;
	zoomLevel: number;
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
	({ element, layout, zoomLevel, canvasClassName, buildGraph, postRender, resolveCanvasSize }: GraphCanvasProps) => {
		const graphContainer = useRef<SVGSVGElement>(null);
		const navigate = useNavigate();
		const [connectionDialogId, setConnectionDialogId] = useState<string | null>(null);
		const [nodeHover, setNodeHover] = useState<GraphNodeHoverState | null>(null);
		const setNodeHoverRef = useRef(setNodeHover);
		setNodeHoverRef.current = setNodeHover;
		const clearHoverTimer = useRef<() => void>(() => undefined);
		const assetCount = rootStore.assets.assets.length;
		const groupCount = rootStore.groups.groups.length;
		const connectionCount = rootStore.connections.connections.length;
		const assignmentEpoch = hierarchyAssignmentEpoch(rootStore.groups.groups);
		const ownerEpoch = hierarchyOwnerEpoch(rootStore.assets.assets);
		const statusEpoch = hierarchyStatusEpoch(rootStore.groups.groups, rootStore.assets.assets);
		const renderGraph = useCallback(() => {
			const view = rootStore.ui.activeView;
			if (!view || !element || !isTreeElement(element) || !graphContainer.current) {
				return;
			}
			void rootStore.ui.elementMarks;

			try {
			const graphRoot = element as TreeElement;
			const graphConfig = resolveGraphConfigForView(view.settings);
			const g = new dagreD3.graphlib.Graph({ compound: true, directed: true });
			g.setDefaultEdgeLabel(() => ({ label: "" }));
			g.setGraph({});
			g.graph().rankdir = layout.rankdir ?? "TB";
			g.graph().ranksep = layout.ranksep ?? 70;
			g.graph().nodesep = layout.nodesep ?? 5;
			g.graph().marginx = 0;
			g.graph().marginy = 0;

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
			clearHoverTimer.current();
			clearHoverTimer.current = bindNodeHover(svg, (next) => setNodeHoverRef.current(next));
			setNodeHoverRef.current(null);

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
			} catch (error) {
				console.error("Graph-Render fehlgeschlagen", error);
			}
		}, [
			element,
			layout.rankdir,
			layout.ranksep,
			layout.nodesep,
			buildGraph,
			navigate,
			zoomLevel,
			postRender,
			resolveCanvasSize,
			assetCount,
			groupCount,
			connectionCount,
			assignmentEpoch,
			ownerEpoch,
			statusEpoch,
		]);

		useEffect(() => {
			const timer = window.setTimeout(() => {
				renderGraph();
			}, 32);
			const viewport = graphContainer.current?.parentElement;
			const hideHover = () => setNodeHover(null);
			viewport?.addEventListener("scroll", hideHover);
			window.addEventListener("resize", hideHover);
			return () => {
				window.clearTimeout(timer);
				clearHoverTimer.current();
				viewport?.removeEventListener("scroll", hideHover);
				window.removeEventListener("resize", hideHover);
				if (graphContainer.current) {
					const svg = select(graphContainer.current);
					svg.selectAll("g.node, g.cluster, g.edgePath").on("click", null);
					svg.selectAll(".graph-node-shell").on("mouseenter.hover", null).on("mouseleave.hover", null);
				}
				setNodeHover(null);
			};
		}, [renderGraph]);

		return (
			<div className={["graph-canvas", canvasClassName].filter(Boolean).join(" ")}>
				<div className="graph-canvas__viewport">
					<svg ref={graphContainer} className="graph-canvas__svg">
						<style>{GRAPH_INLINE_STYLE}</style>
					</svg>
				</div>
				<GraphNodeHoverOverlay hover={nodeHover} />
				<ConnectionDialog connectionId={connectionDialogId} onClose={() => setConnectionDialogId(null)} />
			</div>
		);
	}
);

export const ElementGraphOverview = observer(
	({ element, zoomLevel }: { element: ActiveElement; zoomLevel: number }) => (
	<GraphCanvas
		element={element}
		zoomLevel={zoomLevel}
		layout={{ rankdir: "TB", ranksep: 80, nodesep: 48 }}
		buildGraph={(g, root, config) => {
			addTreeNodesToGraph(g, {
				depth: 10,
				parentId: root.id,
				root,
				activeElementId: rootStore.ui.activeElement?.id,
				config,
			});
			const edges = collectGraphEdges(root, collectRenderedGraphNodeIds(g));
			addConnectionEdgesToGraph(g, edges);
			return edges;
		}}
		postRender={(svg, _root, graphConfig, viewportWidth, dagreGraph) => {
			const assets = rootStore.assets.assets;
			const assetById = rootStore.assets.assetById;
			applyOverviewClusterLayout(svg, dagreGraph, {
				isViewGroup: (nodeId) => rootStore.groups.groups.some((group) => group.id === nodeId),
				isDeviceUnit: (nodeId) => {
					const asset = assetById.get(nodeId);
					return !!asset && !isStackMemberAsset(asset, assets, assetById);
				},
			});
			return undefined;
		}}
	/>
));

export const ElementGraphSwimlanes = observer(
	({ element, zoomLevel }: { element: ActiveElement; zoomLevel: number }) => (
	<GraphCanvas
		element={element}
		zoomLevel={zoomLevel}
		canvasClassName="graph-canvas--swimlanes"
		layout={{ rankdir: "TB", ranksep: 80, nodesep: 40 }}
		buildGraph={(g, _root, config) => {
			const view = rootStore.ui.activeView;
			if (!view) {
				return [];
			}
			const viewRoot = view as TreeElement;
			buildSwimlaneGraph(g, viewRoot, config, rootStore.ui.activeElement?.id);
			const edges = collectConnectionGraphEdges(
				rootStore.assets.assets.slice(),
				rootStore.connections.connections.slice(),
				collectRenderedGraphNodeIds(g)
			);
			addConnectionEdgesToGraph(g, edges);
			return edges;
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

export const ElementGraphMap = observer(
	({ element, zoomLevel }: { element: ActiveElement; zoomLevel: number }) => {
	const flatNodesRef = useRef<TreeElement[]>([]);

	return (
		<GraphCanvas
			element={element}
			zoomLevel={zoomLevel}
			layout={{ rankdir: "TB", ranksep: 20, nodesep: 20 }}
			buildGraph={(g, root, config) => {
				const flatNodes: TreeElement[] = [];
				const seen = new Set<string>();
				const walk = (node: TreeElement, depth: number) => {
					if (!node?.definition || seen.has(node.id)) {
						return;
					}
					seen.add(node.id);
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
				const edges = collectGraphEdges(root, collectRenderedGraphNodeIds(g));
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
