import { select, Selection } from "d3-selection";
import * as dagreD3 from "dagre-d3-es";
import { rootStore } from "../Stores/Root.Store";
import { IAsset } from "../Stores/Models/Asset.Model";
import {
	collectAssetStackLayersFromAssets,
	findAssetStackRoots,
	flattenAssetStackLayers,
	hasMultiLayerAssetStack,
	isGraphStackClusterId,
	resolveAssetStackRootId,
	STACK_COLUMN_GAP,
	STACK_LAYER_GAP,
	STACK_PAD,
	STACK_PARALLEL_GAP,
} from "./graphComponentStack";
import { rerouteDagreGraphEdges, syncDagreNodeBox } from "./graphDagreRender";
import {
	applyGraphNodeCenterTransform,
	measureGraphNodeSize,
	readGraphNodeId,
	resizeGraphNodeBox,
} from "./graphNodeMeasure";

type DagreGraph = dagreD3.graphlib.Graph;

type StackNodePosition = {
	centerX: number;
	centerY: number;
	width: number;
	height: number;
};

function selectRenderedGraphNodes(
	svg: Selection<SVGSVGElement, unknown, null, undefined>
) {
	const scoped = svg.selectAll<SVGGElement, string>("g.output g.nodes g.node");
	if (!scoped.empty()) {
		return scoped;
	}
	return svg.selectAll<SVGGElement, string>("g.node");
}

function readDagreNodeBox(graph: DagreGraph, nodeId: string): { x: number; y: number; width: number; height: number } | null {
	const node = graph.node(nodeId) as { x?: number; y?: number; width?: number; height?: number } | undefined;
	if (!node || node.x == null || node.y == null) {
		return null;
	}
	return {
		x: node.x,
		y: node.y,
		width: node.width ?? 0,
		height: node.height ?? 0,
	};
}

function readStackAnchorCenter(
	graph: DagreGraph,
	memberIds: string[]
): { x: number; y: number } | null {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	let found = false;

	for (const memberId of memberIds) {
		const box = readDagreNodeBox(graph, memberId);
		if (!box) {
			continue;
		}
		found = true;
		minX = Math.min(minX, box.x - box.width / 2);
		maxX = Math.max(maxX, box.x + box.width / 2);
		minY = Math.min(minY, box.y - box.height / 2);
		maxY = Math.max(maxY, box.y + box.height / 2);
	}

	if (!found) {
		return null;
	}

	return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

/**
 * Stapel-Spitze (leaf) oben, Wurzel (layers[0]) unten — wie Tree/Referenzdiagramm.
 * Koordinaten: Mittelpunkt jedes Knotens (dagre-Konvention).
 */
function layoutStackColumn(
	nodesById: Map<string, SVGGElement>,
	layers: IAsset[][],
	stackLeft: number,
	stackTop: number
): { width: number; height: number; positions: Map<string, StackNodePosition> } {
	const positions = new Map<string, StackNodePosition>();

	const layerLayouts = layers.map((layer) => {
		const sizes = layer.map((member) => {
			const node = nodesById.get(member.id);
			return node ? measureGraphNodeSize(node) : { width: 0, height: 0 };
		});
		const layerHeight = Math.max(0, ...sizes.map((size) => size.height));
		const naturalWidth =
			layer.length === 1
				? sizes[0]?.width ?? 0
				: sizes.reduce((sum, size) => sum + size.width, 0) +
					Math.max(0, layer.length - 1) * STACK_PARALLEL_GAP;
		return { layer, sizes, layerHeight, naturalWidth };
	});

	const columnWidth =
		Math.max(120, ...layerLayouts.map((entry) => entry.naturalWidth)) + STACK_PAD * 2;

	let cursorY = stackTop + STACK_PAD;

	for (let layerIndex = layerLayouts.length - 1; layerIndex >= 0; layerIndex--) {
		const { layer, sizes, layerHeight } = layerLayouts[layerIndex];
		const innerWidth = columnWidth - STACK_PAD * 2;
		let cursorX = stackLeft + STACK_PAD;

		if (layer.length === 1) {
			const member = layer[0];
			const node = nodesById.get(member.id);
			if (node) {
				const size = sizes[0];
				const nodeWidth = innerWidth;
				const nodeHeight = size.height;
				resizeGraphNodeBox(node, nodeWidth, nodeHeight);
				positions.set(member.id, {
					centerX: stackLeft + STACK_PAD + nodeWidth / 2,
					centerY: cursorY + nodeHeight / 2,
					width: nodeWidth,
					height: nodeHeight,
				});
			}
		} else {
			const gapTotal = Math.max(0, layer.length - 1) * STACK_PARALLEL_GAP;
			const slotWidth = Math.max(40, (innerWidth - gapTotal) / layer.length);
			layer.forEach((member, index) => {
				const node = nodesById.get(member.id);
				if (!node) {
					return;
				}
				const size = sizes[index];
				const nodeHeight = size.height;
				resizeGraphNodeBox(node, slotWidth, nodeHeight);
				positions.set(member.id, {
					centerX: cursorX + slotWidth / 2,
					centerY: cursorY + layerHeight / 2,
					width: slotWidth,
					height: nodeHeight,
				});
				cursorX += slotWidth + STACK_PARALLEL_GAP;
			});
		}

		cursorY += layerHeight + STACK_LAYER_GAP;
	}

	const totalHeight = Math.max(cursorY + STACK_PAD - stackTop, STACK_PAD * 2);

	return {
		width: columnWidth,
		height: totalHeight,
		positions,
	};
}

function hideLegacyStackClusters(svg: Selection<SVGSVGElement, unknown, null, undefined>): void {
	svg.selectAll<SVGGElement, string>("g.output g.clusters g.cluster, g.cluster").each(function () {
		const clusterId = readGraphNodeId(this) ?? this.getAttribute("id") ?? "";
		if (isGraphStackClusterId(clusterId)) {
			select(this).style("display", "none");
		}
	});
}

function applyStackPositions(
	stackNodes: Map<string, SVGGElement>,
	positions: Map<string, StackNodePosition>
): void {
	for (const [memberId, pos] of Array.from(positions)) {
		const node = stackNodes.get(memberId);
		if (!node) {
			continue;
		}
		applyGraphNodeCenterTransform(node, pos.centerX, pos.centerY);
	}
}

function reorderStackNodesInDom(
	svg: Selection<SVGSVGElement, unknown, null, undefined>,
	layers: IAsset[][],
	stackNodes: Map<string, SVGGElement>
): void {
	const nodesGroup = svg.select<SVGGElement>("g.output g.nodes");
	const parent = nodesGroup.node();
	if (!parent) {
		return;
	}

	for (const layer of layers) {
		for (const member of layer) {
			const node = stackNodes.get(member.id);
			if (node) {
				parent.appendChild(node);
			}
		}
	}
}

function syncStackPositionsToDagreGraph(
	graph: DagreGraph,
	positions: Map<string, StackNodePosition>
): void {
	for (const [memberId, pos] of Array.from(positions)) {
		syncDagreNodeBox(graph, memberId, pos.centerX, pos.centerY, pos.width, pos.height);
	}
}

/** Nach dagre-Render: Stapel-Knoten übereinander (Spitze oben), zentriert, Kanten neu anbinden. */
export function applyGraphAssetStackLayout(
	svg: Selection<SVGSVGElement, unknown, null, undefined>,
	graph: DagreGraph
): void {
	const assets = rootStore.assets.assets;
	const nodeSelection = selectRenderedGraphNodes(svg);
	if (nodeSelection.empty()) {
		return;
	}

	const nodesById = new Map<string, SVGGElement>();
	nodeSelection.each(function (nodeId) {
		nodesById.set(nodeId, this);
	});

	const allStackPositions = new Map<string, StackNodePosition>();

	for (const rootAsset of findAssetStackRoots(assets)) {
		const layers = collectAssetStackLayersFromAssets(rootAsset, assets);
		if (!hasMultiLayerAssetStack(layers)) {
			continue;
		}

		const members = flattenAssetStackLayers(layers);
		const stackNodes = new Map<string, SVGGElement>();
		for (const member of members) {
			const node = nodesById.get(member.id);
			if (node) {
				stackNodes.set(member.id, node);
			}
		}
		if (stackNodes.size <= 1) {
			continue;
		}

		const memberIds = members.map((member) => member.id);
		const anchorCenter =
			readStackAnchorCenter(graph, memberIds) ??
			(() => {
				const rootBox = readDagreNodeBox(graph, rootAsset.id);
				return rootBox ? { x: rootBox.x, y: rootBox.y } : null;
			})();
		if (!anchorCenter) {
			continue;
		}

		const layout = layoutStackColumn(stackNodes, layers, 0, 0);
		const offsetX = anchorCenter.x - layout.width / 2;
		const offsetY = anchorCenter.y - layout.height / 2;
		const adjustedPositions = new Map<string, StackNodePosition>();
		for (const [memberId, pos] of Array.from(layout.positions)) {
			adjustedPositions.set(memberId, {
				...pos,
				centerX: pos.centerX + offsetX,
				centerY: pos.centerY + offsetY,
			});
		}
		applyStackPositions(stackNodes, adjustedPositions);
		reorderStackNodesInDom(svg, layers, stackNodes);
		for (const [memberId, pos] of Array.from(adjustedPositions)) {
			allStackPositions.set(memberId, pos);
		}
	}

	syncStackPositionsToDagreGraph(graph, allStackPositions);
	if (allStackPositions.size > 0) {
		rerouteDagreGraphEdges(svg, graph);
	}

	hideLegacyStackClusters(svg);
}

function isSwimlaneUtilityNode(nodeId: string | undefined): boolean {
	if (!nodeId) {
		return false;
	}
	return nodeId.endsWith("__width-spacer") || nodeId.endsWith("__placeholder");
}

/** Swimlane: Stapel-Spalten in g.nodes positionieren (Lane-Cluster nur als Rahmen). */
export function layoutSwimlaneStackNodes(
	svg: Selection<SVGSVGElement, unknown, null, undefined>,
	graph: DagreGraph,
	laneNodeId: string,
	laneLeft: number,
	laneTop: number,
	_contentWidth: number
): number {
	const assets = rootStore.assets.assets;
	const laneChildIds = (graph.children(laneNodeId) ?? []).filter(
		(nodeId) => !isSwimlaneUtilityNode(nodeId) && !isGraphStackClusterId(nodeId)
	);

	const nodeSelection = selectRenderedGraphNodes(svg);
	const nodesById = new Map<string, SVGGElement>();
	nodeSelection.each(function (nodeId) {
		nodesById.set(nodeId, this);
	});

	const stackRootIds = new Set<string>();
	for (const nodeId of laneChildIds) {
		const rootId = resolveAssetStackRootId(nodeId, assets);
		if (rootId) {
			stackRootIds.add(rootId);
		}
	}

	const stackEntries: Array<{ rootId: string; layers: IAsset[][] }> = [];
	const standaloneIds: string[] = [];

	for (const rootId of Array.from(stackRootIds)) {
		const rootAsset = assets.find((item) => item.id === rootId);
		if (!rootAsset) {
			continue;
		}
		const layers = collectAssetStackLayersFromAssets(rootAsset, assets);
		if (hasMultiLayerAssetStack(layers)) {
			stackEntries.push({ rootId, layers });
		}
	}

	for (const nodeId of laneChildIds) {
		const rootId = resolveAssetStackRootId(nodeId, assets);
		const inStack = stackEntries.some((entry) => entry.rootId === rootId);
		if (inStack && rootId !== nodeId) {
			continue;
		}
		if (!inStack) {
			standaloneIds.push(nodeId);
		}
	}

	let cursorX = STACK_PAD;
	let bodyHeight = 88;

	for (const entry of stackEntries) {
		const members = flattenAssetStackLayers(entry.layers);
		const columnNodes = new Map<string, SVGGElement>();
		for (const member of members) {
			const node = nodesById.get(member.id);
			if (node) {
				columnNodes.set(member.id, node);
			}
		}
		const stackLeft = laneLeft + cursorX;
		const layout = layoutStackColumn(columnNodes, entry.layers, stackLeft, laneTop);
		applyStackPositions(columnNodes, layout.positions);
		bodyHeight = Math.max(bodyHeight, layout.height + STACK_PAD * 2);
		cursorX += layout.width + STACK_COLUMN_GAP;
	}

	for (const nodeId of standaloneIds) {
		const node = nodesById.get(nodeId);
		if (!node) {
			continue;
		}
		const { width, height } = measureGraphNodeSize(node);
		applyGraphNodeCenterTransform(
			node,
			laneLeft + cursorX + width / 2,
			laneTop + STACK_PAD + height / 2
		);
		bodyHeight = Math.max(bodyHeight, height + STACK_PAD * 2);
		cursorX += width + STACK_COLUMN_GAP;
	}

	return Math.max(bodyHeight, 88);
}

/** @deprecated — applyGraphAssetStackLayout nutzen. */
export function applyComponentStackClusterLayout(
	svg: Selection<SVGSVGElement, unknown, null, undefined>,
	graph?: DagreGraph
): void {
	if (graph) {
		applyGraphAssetStackLayout(svg, graph);
	}
}
