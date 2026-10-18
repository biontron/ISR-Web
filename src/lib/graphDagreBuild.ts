import * as dagreD3 from "dagre-d3-es";
import { TreeElement } from "../Interfaces/Element";
import { rootStore } from "../Stores/Root.Store";
import { formatAssetDefinitionTypeLabel, resolveAssetElementType } from "./elementDefinitionTypes";
import { GraphConfig, loadGraphConfig } from "./graphConfig";
import { ConnectionGraphEdge } from "./graphConnectionEdges";
import {
	collectAssetStackLayersFromAssets,
	flattenAssetStackLayers,
	hasMultiLayerAssetStack,
	isAssetStackChildOf,
	isStackMemberAsset,
	resolveAssetStackRootId,
} from "./graphComponentStack";
import {
	graphStyleToSvgNodeStyle,
	readElementGraphPosition,
	resolveGraphStyle,
} from "./graphElementStyle";
import { buildElementSignalBarsHtml } from "./elementSignalBars";
import { elementStatusShowsIndicator } from "./elementStatusStyle";
import { IAsset } from "../Stores/Models/Asset.Model";
import { collectContextComponents } from "./connectionDevice";
import {
	collectGraphDockCircles,
	renderGraphDockCirclesHtml,
} from "./connectionGraphCircles";
import { indexById } from "./hierarchyIndex";
import { GRAPH_MAX_TREE_NODES, resolveGraphTreeDepth } from "./graphTreeLimits";

export { GRAPH_MAX_TREE_NODES, resolveGraphTreeDepth } from "./graphTreeLimits";

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

type GraphLabelContext = {
	contextHosts: IAsset[];
};

function buildNodeLabel(
	node: TreeElement,
	condensed: boolean,
	omitIcon = false,
	labelContext?: GraphLabelContext
): string {
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
	const marks = rootStore.ui.elementMarks.get(node.id);
	const signalBars = buildElementSignalBarsHtml(
		{
			changed: elementStatusShowsIndicator(node.status) || !!marks?.changed,
			positive: !!marks?.positive,
			negative: !!marks?.negative,
		},
		"horizontal"
	);
	const isClusterLabel = omitIcon;
	const fontSize = isClusterLabel ? "14.3px" : "13px";
	const fontWeight = isClusterLabel ? "700" : "400";
	const labelClass = isClusterLabel ? "Label graph-cluster-label" : `Label ${styleType}`;
	const contextHosts = labelContext?.contextHosts ?? [];
	const circlesHtml =
		node.class === "Asset" || node.class === "AssetDetails"
			? renderGraphDockCirclesHtml(collectGraphDockCircles(node as IAsset, contextHosts))
			: "";

	return `
		<div class="graph-node-shell">
			${signalBars}
			<div class="${labelClass}" style="display:flex;align-items:flex-start;gap:6px;font-size:${fontSize};font-weight:${fontWeight};line-height:1.3;color:#111;white-space:nowrap;">
				<span class="graph-icon" style="display:inline-flex;align-items:flex-start;justify-content:center;flex:0 0 auto;">
					${icon}
				</span>
				<span class="graph-link" style="display:inline-block;color:#111;text-decoration:underline;white-space:nowrap;font-weight:${fontWeight};">
					${name}
				</span>
			</div>
			${circlesHtml}
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

function treeGraphHasWalkableChild(
	children: Array<TreeElement | null | undefined>,
	parent: TreeElement
): boolean {
	for (const child of children) {
		if (!child || !(child as TreeElement).definition) {
			continue;
		}
		const treeChild = child as TreeElement;
		if (parent.class === "Asset" && isAssetStackChildOf(parent, treeChild)) {
			continue;
		}
		if (
			treeChild.class === "View" ||
			treeChild.class === "Group" ||
			treeChild.class === "Asset" ||
			treeChild.class === "AssetDetails"
		) {
			return true;
		}
	}
	return false;
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
	const assetById = indexById(Array.from(assets));
	const labelContext: GraphLabelContext = {
		contextHosts: collectContextComponents(Array.from(assets)),
	};
	const maxDepth = resolveGraphTreeDepth(options.depth);
	let nodeCount = 0;
	type GraphWalkItem = { node: TreeElement; currentDepth: number; parentId: string };
	const queue: GraphWalkItem[] = [];

	function addAssetStackMembersToGraph(rootAsset: TreeElement, graphParentId: string) {
		const root = assetById.get(rootAsset.id);
		if (!root) {
			return;
		}
		const layers = collectAssetStackLayersFromAssets(root, assets);
		const members = flattenAssetStackLayers(layers);

		for (const member of members) {
			if (nodeCount >= GRAPH_MAX_TREE_NODES) {
				return;
			}
			const memberStyle = resolveGraphStyle(member as unknown as TreeElement, {
				config,
				isActive: options.activeElementId === member.id,
			});
			nodeCount += 1;
			ensureGraphNode(g, member.id, {
				labelType: "html",
				label: buildNodeLabel(member as unknown as TreeElement, false, false, labelContext),
				style: graphStyleToSvgNodeStyle(memberStyle),
				id: member.id,
			});
			if (graphParentId && graphParentId !== member.id) {
				safeSetParent(g, member.id, graphParentId);
			}
		}
	}

	function enqueueChildren(node: TreeElement, children: Array<TreeElement | null | undefined>, currentDepth: number) {
		if (currentDepth >= maxDepth || !g.hasNode(node.id)) {
			return;
		}
		const structure: GraphWalkItem[] = [];
		const members: GraphWalkItem[] = [];
		for (const child of children) {
			if (!child || !(child as TreeElement).definition) {
				continue;
			}
			const treeChild = child as TreeElement;
			if (node.class === "Asset" && isAssetStackChildOf(node, treeChild)) {
				continue;
			}
			const item = { node: treeChild, currentDepth: currentDepth + 1, parentId: node.id };
			if (treeChild.class === "View" || treeChild.class === "Group") {
				structure.push(item);
			} else {
				members.push(item);
			}
		}
		queue.push(...structure, ...members);
	}

	function processNode(node: TreeElement, currentDepth: number, parentId: string) {
		if (!node?.definition || nodeCount >= GRAPH_MAX_TREE_NODES) {
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
			if (isStackMemberAsset(node, assets, assetById)) {
				if (node.id === options.root.id) {
					const stackRootId = resolveAssetStackRootId(node.id, assets, assetById);
					const stackRoot = assetById.get(stackRootId);
					if (stackRoot) {
						addAssetStackMembersToGraph(
							stackRoot as unknown as TreeElement,
							node.id === parentId ? "" : parentId
						);
					}
				}
				return;
			}
			const rootAsset = assetById.get(node.id);
			if (rootAsset) {
				const layers = collectAssetStackLayersFromAssets(rootAsset, assets);
				if (hasMultiLayerAssetStack(layers)) {
					addAssetStackMembersToGraph(
						node,
						node.id === parentId ? "" : parentId
					);
					return;
				}
			}
		}

		const children =
			currentDepth < maxDepth && typeof node.children === "function" ? node.children() : [];
		const isActive = options.activeElementId === node.id;
		const style = resolveGraphStyle(node, { config, isActive });
		const svgStyle = graphStyleToSvgNodeStyle(style);
		const willBeCluster =
			node.class === "View" ||
			node.class === "Group" ||
			treeGraphHasWalkableChild(children, node);

		nodeCount += 1;
		ensureGraphNode(g, node.id, {
			labelType: "html",
			label: buildNodeLabel(node, false, willBeCluster, labelContext),
			clusterLabelPos: "top",
			style: svgStyle,
			id: node.id,
		});

		if (node.id !== parentId) {
			safeSetParent(g, node.id, parentId);
		}

		enqueueChildren(node, children, currentDepth);
	}

	if (g.hasNode(options.parentId) || options.parentId === options.root.id) {
		queue.push({ node: options.root, currentDepth: 0, parentId: options.parentId });
	} else {
		queue.push({ node: options.root, currentDepth: 0, parentId: options.root.id });
	}

	let head = 0;
	while (head < queue.length && nodeCount < GRAPH_MAX_TREE_NODES) {
		const item = queue[head];
		head += 1;
		processNode(item.node, item.currentDepth, item.parentId);
	}
}

function ensureBridgeStubNode(g: dagreD3.graphlib.Graph, nodeId: string, label: string) {
	if (g.hasNode(nodeId)) {
		return;
	}
	g.setNode(nodeId, {
		labelType: "html",
		label: `<div class="graph-bridge-stub">${label}</div>`,
		class: "graph-bridge-stub-node",
		rx: 8,
		ry: 8,
	});
}

export function addConnectionEdgesToGraph(
	g: dagreD3.graphlib.Graph,
	edges: ConnectionGraphEdge[]
) {
	for (const edge of edges) {
		if (edge.fromNodeId.startsWith("bridge-stub:")) {
			ensureBridgeStubNode(g, edge.fromNodeId, edge.label || "Brücke");
		}
		if (edge.toNodeId.startsWith("bridge-stub:")) {
			ensureBridgeStubNode(g, edge.toNodeId, edge.label || "Brücke");
		}
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
	const labelContext: GraphLabelContext = {
		contextHosts: collectContextComponents(Array.from(rootStore.assets.assets)),
	};
	nodes.slice(0, GRAPH_MAX_TREE_NODES).forEach((node, index) => {
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
			label: buildNodeLabel(node, true, false, labelContext),
			style: graphStyleToSvgNodeStyle(style),
			id: node.id,
			x: position.x,
			y: position.y,
			width: 120,
			height: 48,
		});
	});
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
