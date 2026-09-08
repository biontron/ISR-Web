import { select, Selection } from "d3-selection";
import * as dagreD3 from "dagre-d3-es";
import { IAsset } from "../Stores/Models/Asset.Model";
import { rootStore } from "../Stores/Root.Store";
import {
	collectAssetStackLayersFromAssets,
	flattenAssetStackLayers,
	hasMultiLayerAssetStack,
	isGraphStackClusterId,
} from "./graphComponentStack";
import {
	measureAssetStackColumn,
	placeAssetStackColumn,
} from "./graphComponentStackLayout";
import { rerouteDagreGraphEdges, syncDagreNodeBox } from "./graphDagreRender";
import {
	applyGraphNodeCenterTransform,
	measureGraphNodeSize,
	readGraphNodeId,
} from "./graphNodeMeasure";
import {
	OVERVIEW_CLUSTER_PAD,
	OVERVIEW_DEVICE_GAP_X,
	OVERVIEW_DEVICE_GAP_Y,
	OVERVIEW_DEVICES_PER_ROW,
	OVERVIEW_GROUP_GAP,
	OVERVIEW_MARGIN,
	packItemsLeftToRightRows,
} from "./graphOverviewLayout";

type DagreGraph = dagreD3.graphlib.Graph;

export type OverviewClusterLayoutOptions = {
	isViewGroup: (nodeId: string) => boolean;
	isDeviceUnit: (nodeId: string) => boolean;
	devicesPerRow?: number;
};

type SizedUnit = {
	id: string;
	width: number;
	height: number;
	kind: "stack" | "node";
	layers?: IAsset[][];
};

function selectRenderedGraphNodes(svg: Selection<SVGSVGElement, unknown, null, undefined>) {
	const scoped = svg.selectAll<SVGGElement, string>("g.output g.nodes g.node");
	if (!scoped.empty()) {
		return scoped;
	}
	return svg.selectAll<SVGGElement, string>("g.node");
}

function selectRenderedGraphClusters(svg: Selection<SVGSVGElement, unknown, null, undefined>) {
	const scoped = svg.selectAll<SVGGElement, string>("g.output g.clusters g.cluster");
	if (!scoped.empty()) {
		return scoped;
	}
	return svg.selectAll<SVGGElement, string>("g.cluster");
}

function isIgnoredId(nodeId: string | undefined): boolean {
	return !nodeId || isGraphStackClusterId(nodeId);
}

function childIds(graph: DagreGraph, parentId: string): string[] {
	return (graph.children(parentId) ?? []).filter((nodeId) => !isIgnoredId(nodeId));
}

function isClusterId(graph: DagreGraph, nodeId: string): boolean {
	return childIds(graph, nodeId).length > 0;
}

function measureClusterLabelHeight(cluster: SVGGElement | undefined): number {
	if (!cluster) {
		return 22;
	}
	const label = cluster.querySelector("g.label");
	if (!label) {
		return 22;
	}
	try {
		return Math.max(22, (label as SVGGElement).getBBox().height);
	} catch {
		return 22;
	}
}

function applyClusterBox(
	cluster: SVGGElement,
	graph: DagreGraph,
	nodeId: string,
	left: number,
	top: number,
	width: number,
	height: number
): void {
	const centerX = left + width / 2;
	const centerY = top + height / 2;
	select(cluster).attr("transform", `translate(${centerX},${centerY})`);
	const rect = cluster.querySelector("rect");
	if (rect) {
		rect.setAttribute("x", String(-width / 2));
		rect.setAttribute("y", String(-height / 2));
		rect.setAttribute("width", String(width));
		rect.setAttribute("height", String(height));
	}
	const label = cluster.querySelector("g.label") as SVGGElement | null;
	if (label) {
		const pad = 8;
		label.setAttribute("transform", `translate(${-width / 2 + pad},${-height / 2 + pad})`);
		const innerLabel = label.querySelector(":scope > g");
		if (innerLabel) {
			innerLabel.setAttribute("transform", "translate(0,0)");
		}
	}
	cluster.style.clipPath = "none";
	syncDagreNodeBox(graph, nodeId, centerX, centerY, width, height);
}

function placeLeafNode(
	node: SVGGElement,
	graph: DagreGraph,
	nodeId: string,
	left: number,
	top: number,
	width: number,
	height: number
): void {
	applyGraphNodeCenterTransform(node, left + width / 2, top + height / 2);
	syncDagreNodeBox(graph, nodeId, left + width / 2, top + height / 2, width, height);
}

function hideLegacyStackClusters(svg: Selection<SVGSVGElement, unknown, null, undefined>): void {
	svg.selectAll<SVGGElement, string>("g.output g.clusters g.cluster, g.cluster").each(function () {
		const clusterId = readGraphNodeId(this) ?? this.getAttribute("id") ?? "";
		if (isGraphStackClusterId(clusterId)) {
			select(this).style("display", "none");
		}
	});
}

/**
 * Übersicht nach dagre: View-Gruppen untereinander linksbündig,
 * Geräte von oben links nach unten rechts (max. 10 je Zeile).
 */
export function applyOverviewClusterLayout(
	svg: Selection<SVGSVGElement, unknown, null, undefined>,
	graph: DagreGraph,
	options: OverviewClusterLayoutOptions
): void {
	const assets = rootStore.assets.assets;
	const devicesPerRow = options.devicesPerRow ?? OVERVIEW_DEVICES_PER_ROW;
	const nodesById = new Map<string, SVGGElement>();
	const clustersById = new Map<string, SVGGElement>();

	selectRenderedGraphNodes(svg).each(function (nodeId) {
		if (typeof nodeId === "string") {
			nodesById.set(nodeId, this);
		}
	});
	selectRenderedGraphClusters(svg).each(function (nodeId) {
		if (typeof nodeId === "string") {
			clustersById.set(nodeId, this);
		}
	});

	function measureDeviceUnit(nodeId: string): SizedUnit {
		const asset = assets.find((item) => item.id === nodeId);
		if (asset) {
			const layers = collectAssetStackLayersFromAssets(asset, assets);
			if (hasMultiLayerAssetStack(layers)) {
				const members = flattenAssetStackLayers(layers);
				const columnNodes = new Map<string, SVGGElement>();
				for (const member of members) {
					const node = nodesById.get(member.id);
					if (node) {
						columnNodes.set(member.id, node);
					}
				}
				const size = measureAssetStackColumn(columnNodes, layers);
				return {
					id: nodeId,
					width: size.width,
					height: size.height,
					kind: "stack",
					layers,
				};
			}
		}
		const node = nodesById.get(nodeId);
		const size = node ? measureGraphNodeSize(node) : { width: 80, height: 40 };
		return { id: nodeId, width: size.width, height: size.height, kind: "node" };
	}

	function placeDeviceUnit(unit: SizedUnit, left: number, top: number): void {
		if (unit.kind === "stack" && unit.layers) {
			const members = flattenAssetStackLayers(unit.layers);
			const columnNodes = new Map<string, SVGGElement>();
			for (const member of members) {
				const node = nodesById.get(member.id);
				if (node) {
					columnNodes.set(member.id, node);
				}
			}
			const placed = placeAssetStackColumn(columnNodes, unit.layers, left, top);
			for (const [memberId, pos] of Array.from(placed.positions)) {
				syncDagreNodeBox(graph, memberId, pos.centerX, pos.centerY, pos.width, pos.height);
			}
			return;
		}
		const node = nodesById.get(unit.id);
		if (node) {
			placeLeafNode(node, graph, unit.id, left, top, unit.width, unit.height);
		}
	}

	function layoutCluster(clusterId: string, left: number, top: number): { width: number; height: number } {
		const clusterEl = clustersById.get(clusterId);
		const labelHeight = measureClusterLabelHeight(clusterEl);
		const pad = OVERVIEW_CLUSTER_PAD;
		const contentLeft = left + pad;
		let cursorY = top + labelHeight + pad;
		let maxRight = contentLeft;
		let maxBottom = cursorY;

		const kids = childIds(graph, clusterId);
		const nestedIds = kids.filter(
			(nodeId) => options.isViewGroup(nodeId) || isClusterId(graph, nodeId)
		);
		const deviceIds = kids.filter((nodeId) => options.isDeviceUnit(nodeId));

		for (const nestedId of nestedIds) {
			const nestedSize = isClusterId(graph, nestedId)
				? layoutCluster(nestedId, contentLeft, cursorY)
				: (() => {
						const node = nodesById.get(nestedId);
						const size = node ? measureGraphNodeSize(node) : { width: 120, height: 40 };
						if (node) {
							placeLeafNode(node, graph, nestedId, contentLeft, cursorY, size.width, size.height);
						}
						return size;
				  })();
			cursorY += nestedSize.height + OVERVIEW_GROUP_GAP;
			maxRight = Math.max(maxRight, contentLeft + nestedSize.width);
			maxBottom = Math.max(maxBottom, cursorY - OVERVIEW_GROUP_GAP);
		}

		if (deviceIds.length > 0) {
			const units = deviceIds.map((nodeId) => measureDeviceUnit(nodeId));
			const packed = packItemsLeftToRightRows(
				units,
				devicesPerRow,
				OVERVIEW_DEVICE_GAP_X,
				OVERVIEW_DEVICE_GAP_Y,
				contentLeft,
				cursorY
			);
			for (const unit of units) {
				const pos = packed.positions.get(unit.id);
				if (!pos) {
					continue;
				}
				placeDeviceUnit(unit, pos.left, pos.top);
			}
			maxRight = Math.max(maxRight, contentLeft + packed.width);
			maxBottom = Math.max(maxBottom, cursorY + packed.height);
		}

		const width = Math.max(160, maxRight - left + pad);
		const height = Math.max(labelHeight + pad * 2, maxBottom - top + pad);
		if (clusterEl) {
			applyClusterBox(clusterEl, graph, clusterId, left, top, width, height);
		}
		return { width, height };
	}

	const roots = graph.nodes().filter((nodeId) => {
		if (isIgnoredId(nodeId)) {
			return false;
		}
		return !graph.parent(nodeId);
	});

	let originY = OVERVIEW_MARGIN;
	for (const rootId of roots) {
		if (isClusterId(graph, rootId)) {
			const size = layoutCluster(rootId, OVERVIEW_MARGIN, originY);
			originY += size.height + OVERVIEW_GROUP_GAP;
			continue;
		}
		if (options.isViewGroup(rootId) || options.isDeviceUnit(rootId)) {
			const unit = options.isDeviceUnit(rootId)
				? measureDeviceUnit(rootId)
				: (() => {
						const node = nodesById.get(rootId);
						const size = node ? measureGraphNodeSize(node) : { width: 120, height: 40 };
						return { id: rootId, width: size.width, height: size.height, kind: "node" as const };
				  })();
			placeDeviceUnit(unit, OVERVIEW_MARGIN, originY);
			originY += unit.height + OVERVIEW_GROUP_GAP;
		}
	}

	rerouteDagreGraphEdges(svg, graph);
	hideLegacyStackClusters(svg);
}
