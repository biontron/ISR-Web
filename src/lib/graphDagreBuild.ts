import * as dagreD3 from "dagre-d3-es";
import { TreeElement } from "../Interfaces/Element";
import { rootStore } from "../Stores/Root.Store";
import { formatAssetDefinitionTypeLabel, resolveAssetElementType } from "./elementDefinitionTypes";
import { GraphConfig, loadGraphConfig } from "./graphConfig";
import {
	assignComponentsToSwimlanes,
	collectSwimlaneComponentsFromTree,
	swimlaneNodeId,
	swimlanePlaceholderId,
	swimlaneWidthSpacerId,
} from "./graphSwimlaneLayout";
import { ConnectionGraphEdge } from "./graphConnectionEdges";
import {
	collectAssetStackLayersFromAssets,
	flattenAssetStackLayers,
	hasMultiLayerAssetStack,
	isAssetStackChildOf,
	isStackMemberAsset,
} from "./graphComponentStack";
import {
	graphStyleToSvgNodeStyle,
	readElementGraphPosition,
	resolveGraphStyle,
} from "./graphElementStyle";
import { buildGraphNodeHoverHtml } from "./treeNodeDisplay";

type DagreNodeConfig = {
	labelType: string;
	label: string;
	clusterLabelPos?: string;
	style: string;
	id?: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
};

function buildNodeLabel(node: TreeElement, condensed: boolean, omitIcon = false): string {
	// Cluster HTML labels (foreignObject) must not embed schema treeIcon SVGs: dagre-d3-es
	// styles selectAll('rect') on clusters and crashes on nested icon rects.
	const showIcon =
		!omitIcon && (node.class === "Asset" || node.class === "AssetDetails");
	const icon = showIcon
		? rootStore.configSchemas.getIconByDefinition(node.definition)
		: "";
	const typeLabel = formatAssetDefinitionTypeLabel(node.definition);
	const styleType = resolveAssetElementType(node.definition) || node.definition.subType || node.definition.baseType || "";
	const name = condensed
		? node.definition.name
		: node.class === "Asset" || node.class === "AssetDetails"
			? `${node.definition.name}<br/>${"label" in node.definition ? node.definition.label : ""}<br/><${typeLabel}>`
			: node.definition.name;
	const hoverHtml = buildGraphNodeHoverHtml(rootStore, node);

	return `
		<div class="graph-node-shell">
			<div class="Label ${styleType}" style="display:flex;align-items:flex-start;gap:6px;font-size:13px;line-height:1.3;color:#111;white-space:nowrap;">
				<span class="graph-icon" style="display:inline-flex;align-items:flex-start;justify-content:center;flex:0 0 auto;">
					${icon}
				</span>
				<span class="graph-link" style="display:inline-block;color:#111;text-decoration:underline;white-space:normal;">
					${name}
				</span>
			</div>
			${hoverHtml}
		</div>`;
}

function ensureGraphNode(
	g: dagreD3.graphlib.Graph,
	nodeId: string,
	config: DagreNodeConfig
) {
	const existing = g.node(nodeId) ?? {};
	g.setNode(nodeId, {
		...existing,
		...config,
		id: config.id ?? nodeId,
		style: config.style ?? (existing as { style?: string }).style ?? "fill:#f5f5f5; stroke:#333; stroke-width:1px;",
	});
}

function safeSetParent(g: dagreD3.graphlib.Graph, childId: string, parentId: string) {
	if (childId === parentId) {
		return;
	}
	if (!g.hasNode(childId) || !g.hasNode(parentId)) {
		return;
	}
	if (!g.node(parentId)) {
		ensureGraphNode(g, parentId, {
			labelType: "html",
			label: parentId,
			clusterLabelPos: "top",
			style: "fill:#f5f5f5; stroke:#333; stroke-width:1px;",
			id: parentId,
		});
	}
	if (!g.node(childId)) {
		ensureGraphNode(g, childId, {
			labelType: "html",
			label: childId,
			style: "fill:#f5f5f5; stroke:#333; stroke-width:1px;",
			id: childId,
		});
	}
	g.setParent(childId, parentId);
}

export const SWIMLANE_GRAPH_ROOT_ID = "__swimlanes_root__";

function ensureSwimlanePlaceholder(
	g: dagreD3.graphlib.Graph,
	laneNodeId: string,
	graphConfig: GraphConfig
) {
	const children = g.children(laneNodeId) ?? [];
	if (children.length > 0) {
		return;
	}

	const placeholderId = swimlanePlaceholderId(laneNodeId);
	const laneStyle = resolveGraphStyle(
		{ class: "Group", properties: { style: { graph: { layout: "GROUP" } } } },
		{ config: graphConfig }
	);
	ensureGraphNode(g, placeholderId, {
		labelType: "html",
		label: "<div class=\"graph-swimlane-empty\">—</div>",
		style: graphStyleToSvgNodeStyle(laneStyle),
		id: placeholderId,
		width: 96,
		height: 36,
	});
	safeSetParent(g, placeholderId, laneNodeId);
}

function ensureSwimlaneWidthSpacer(
	g: dagreD3.graphlib.Graph,
	laneNodeId: string,
	minWidth: number
) {
	const spacerId = swimlaneWidthSpacerId(laneNodeId);
	ensureGraphNode(g, spacerId, {
		labelType: "html",
		label: "",
		style: "fill:none;stroke:none;opacity:0;",
		id: spacerId,
		width: minWidth,
		height: 1,
	});
	safeSetParent(g, spacerId, laneNodeId);
}

function treeGraphChildCount(node: TreeElement, currentDepth: number, maxDepth: number): number {
	if (currentDepth >= maxDepth || typeof node.children !== "function") {
		return 0;
	}
	let count = 0;
	for (const child of node.children()) {
		if (!child || !(child as TreeElement).definition) {
			continue;
		}
		const treeChild = child as TreeElement;
		if (
			node.class === "Asset" &&
			isAssetStackChildOf(node, treeChild)
		) {
			continue;
		}
		if (
			treeChild.class === "View" ||
			treeChild.class === "Group" ||
			treeChild.class === "Asset" ||
			treeChild.class === "AssetDetails"
		) {
			count++;
		}
	}
	return count;
}

export function addTreeNodesToGraph(
	g: dagreD3.graphlib.Graph,
	options: {
		depth: number;
		parentId: string;
		root: TreeElement;
		activeElementId?: string;
		config?: GraphConfig;
	}
) {
	const config = options.config ?? loadGraphConfig();
	const assets = rootStore.assets.assets;

	function addAssetStackMembersToGraph(rootAsset: TreeElement, graphParentId: string) {
		const root = assets.find((item) => item.id === rootAsset.id);
		if (!root) {
			return;
		}
		const layers = collectAssetStackLayersFromAssets(root, assets);
		const members = flattenAssetStackLayers(layers);

		for (const member of members) {
			const memberStyle = resolveGraphStyle(member as unknown as TreeElement, {
				config,
				isActive: options.activeElementId === member.id,
			});
			ensureGraphNode(g, member.id, {
				labelType: "html",
				label: buildNodeLabel(member as unknown as TreeElement, false, false),
				style: graphStyleToSvgNodeStyle(memberStyle),
				id: member.id,
			});
			safeSetParent(g, member.id, graphParentId);
		}
	}

	function walk(node: TreeElement, currentDepth: number, parentId: string) {
		if (!node?.definition) {
			return;
		}

		const isGraphNode =
			node.class === "View" ||
			node.class === "Group" ||
			node.class === "Asset" ||
			node.class === "AssetDetails";

		if (!isGraphNode) {
			return;
		}

		if (node.class === "Asset" || node.class === "AssetDetails") {
			if (isStackMemberAsset(node, assets)) {
				return;
			}
			const root = assets.find((item) => item.id === node.id);
			if (root) {
				const layers = collectAssetStackLayersFromAssets(root, assets);
				if (hasMultiLayerAssetStack(layers)) {
					if (node.id !== parentId) {
						addAssetStackMembersToGraph(node, parentId);
					}
					return;
				}
			}
		}

		const isActive = options.activeElementId === node.id;
		const style = resolveGraphStyle(node, { config, isActive });
		const svgStyle = graphStyleToSvgNodeStyle(style);
		const condensed = false;
		const willBeCluster =
			node.class === "View" ||
			node.class === "Group" ||
			treeGraphChildCount(node, currentDepth, options.depth) > 0;

		ensureGraphNode(g, node.id, {
			labelType: "html",
			label: buildNodeLabel(node, condensed, willBeCluster),
			clusterLabelPos: "top",
			style: svgStyle,
			id: node.id,
		});

		if (node.id !== parentId) {
			safeSetParent(g, node.id, parentId);
		}

		if (currentDepth >= options.depth || typeof node.children !== "function" || !g.hasNode(node.id)) {
			return;
		}
		for (const child of node.children()) {
			if (!child || !(child as TreeElement).definition) {
				continue;
			}
			const treeChild = child as TreeElement;
			if (node.class === "Asset" && isAssetStackChildOf(node, treeChild)) {
				continue;
			}
			walk(treeChild, currentDepth + 1, node.id);
		}
	}

	if (g.hasNode(options.parentId) || options.parentId === options.root.id) {
		walk(options.root, 0, options.parentId);
	} else {
		walk(options.root, 0, options.root.id);
	}
}

export function addConnectionEdgesToGraph(
	g: dagreD3.graphlib.Graph,
	edges: ConnectionGraphEdge[]
) {
	for (const edge of edges) {
		const fromNode = g.node(edge.fromNodeId);
		const toNode = g.node(edge.toNodeId);
		if (!g.hasNode(edge.fromNodeId) || !g.hasNode(edge.toNodeId) || !fromNode || !toNode) {
			continue;
		}
		const edgeLabel = `<span class="graph-link graph-edge-label" data-connection-id="${edge.connectionId}" style="color:#0066cc; font-size:12px; cursor:pointer;">${edge.label}</span>`;
		g.setEdge(edge.fromNodeId, edge.toNodeId, {
			labelType: "html",
			label: edgeLabel,
		});
	}
}

export function addMapPositionedNodes(
	g: dagreD3.graphlib.Graph,
	nodes: TreeElement[],
	activeElementId?: string,
	config?: GraphConfig
) {
	const graphConfig = config ?? loadGraphConfig();
	nodes.forEach((node, index) => {
		if (!node?.definition) {
			return;
		}
		const position = readElementGraphPosition(node) ?? {
			x: 40 + (index % 5) * 140,
			y: 40 + Math.floor(index / 5) * 100,
		};
		const isActive = activeElementId === node.id;
		const style = resolveGraphStyle(node, { config: graphConfig, isActive });
		ensureGraphNode(g, node.id, {
			labelType: "html",
			label: buildNodeLabel(node, true),
			style: graphStyleToSvgNodeStyle(style),
			id: node.id,
			x: position.x,
			y: position.y,
			width: 120,
			height: 48,
		});
	});
}

/** Mindestbreite für dagre-Vorlayout; endgültige Breite setzt applySwimlaneFullWidthLayout. */
export const SWIMLANE_LAYOUT_MIN_WIDTH = 960;

/** Dedicated swimlane graph: lanes + components only (no group tree nesting). */
export function buildSwimlaneGraph(
	g: dagreD3.graphlib.Graph,
	viewRoot: TreeElement,
	config?: GraphConfig,
	activeElementId?: string
) {
	const graphConfig = config ?? loadGraphConfig();
	if (!viewRoot?.definition || typeof viewRoot.children !== "function") {
		return;
	}

	const components = collectSwimlaneComponentsFromTree(viewRoot);
	const componentsByLane = assignComponentsToSwimlanes(components, graphConfig);

	const shellStyle = resolveGraphStyle(viewRoot, { config: graphConfig });
	ensureGraphNode(g, SWIMLANE_GRAPH_ROOT_ID, {
		labelType: "html",
		label: `<div class="graph-swimlane-root">${viewRoot.definition.name}</div>`,
		clusterLabelPos: "top",
		style: graphStyleToSvgNodeStyle(shellStyle),
		id: SWIMLANE_GRAPH_ROOT_ID,
	});

	for (const component of components) {
		const isActive = activeElementId === component.id;
		const style = resolveGraphStyle(component, { config: graphConfig, isActive });
		ensureGraphNode(g, component.id, {
			labelType: "html",
			label: buildNodeLabel(component, true),
			style: graphStyleToSvgNodeStyle(style),
			id: component.id,
		});
	}

	for (const lane of graphConfig.swimlanes) {
		const laneId = swimlaneNodeId(lane.id);
		const laneStyle = resolveGraphStyle(
			{ class: "Group", properties: { style: { graph: { layout: "GROUP" } } } },
			{ config: graphConfig }
		);
		ensureGraphNode(g, laneId, {
			labelType: "html",
			label: "",
			clusterLabelPos: "top",
			style: graphStyleToSvgNodeStyle(laneStyle),
			id: laneId,
		});
		safeSetParent(g, laneId, SWIMLANE_GRAPH_ROOT_ID);

		for (const component of componentsByLane.get(lane.id) ?? []) {
			safeSetParent(g, component.id, laneId);
		}

		ensureSwimlanePlaceholder(g, laneId, graphConfig);
		ensureSwimlaneWidthSpacer(g, laneId, SWIMLANE_LAYOUT_MIN_WIDTH);
	}
}

/** @deprecated Use buildSwimlaneGraph — lanes nested in tree were often invisible. */
export function addSwimlaneLayout(
	g: dagreD3.graphlib.Graph,
	root: TreeElement,
	config?: GraphConfig
) {
	buildSwimlaneGraph(g, root, config);
}

export function repairGraphClusterNodes(g: dagreD3.graphlib.Graph) {
	const fallbackStyle = "fill:#f5f5f5; stroke:#333; stroke-width:1px;";
	const isCluster = (nodeId: string) => (g.children(nodeId)?.length ?? 0) > 0;

	for (const nodeId of g.nodes()) {
		const parentId = g.parent(nodeId);
		if (parentId && !g.hasNode(parentId)) {
			g.setNode(parentId, {
				labelType: "html",
				label: parentId,
				clusterLabelPos: "top",
				style: fallbackStyle,
				id: parentId,
			});
		}
	}

	for (const nodeId of g.nodes()) {
		const node = g.node(nodeId);
		if (!node || typeof node !== "object") {
			g.setNode(nodeId, {
				labelType: "html",
				label: nodeId,
				clusterLabelPos: isCluster(nodeId) ? "top" : undefined,
				style: fallbackStyle,
				id: nodeId,
			});
			continue;
		}
		if (!node.style) {
			node.style = fallbackStyle;
		}
		if (!node.id) {
			node.id = nodeId;
		}
		if (!node.labelType) {
			node.labelType = "html";
		}
		if (isCluster(nodeId)) {
			if (node.label === undefined || node.label === null) {
				node.label = nodeId;
			}
			if (!node.clusterLabelPos) {
				node.clusterLabelPos = "top";
			}
		} else if (!Object.prototype.hasOwnProperty.call(node, "label")) {
			node.label = nodeId;
		}
	}

	for (const nodeId of g.nodes()) {
		const parentId = g.parent(nodeId);
		if (!parentId || g.node(parentId)) {
			continue;
		}
		g.setNode(parentId, {
			labelType: "html",
			label: parentId,
			clusterLabelPos: "top",
			style: fallbackStyle,
			id: parentId,
		});
	}
}
