import { TreeElement } from "../Interfaces/Element";
import { IAsset } from "../Stores/Models/Asset.Model";
import { IConnection, ILink } from "../Stores/Models/Connection.Model";
import {
	findAssetByEndpointRef,
	parseDockRef,
	resolveLinkSideAssetId,
} from "./connectionEndpointRef";
import { resolveConnectionDirection } from "./connectionDirection";
import { resolveAssetStackRootId } from "./graphComponentStack";

export type ConnectionGraphEdge = {
	connectionId: string;
	linkId: string;
	direction: ReturnType<typeof resolveConnectionDirection>;
	label: string;
	fromNodeId: string;
	toNodeId: string;
	fromDockRef: string;
	toDockRef: string;
};

function edgeKey(connectionId: string, linkId: string): string {
	return `${connectionId}:${linkId}`;
}

function isUtilityGraphNodeId(nodeId: string): boolean {
	return !nodeId || nodeId.startsWith("__");
}

/** Knoten, die nach dem Graph-Aufbau wirklich existieren — inkl. innerer Stack-Components. */
export function collectRenderedGraphNodeIds(graph: { nodes: () => string[] }): Set<string> {
	return new Set(graph.nodes().filter((nodeId) => !isUtilityGraphNodeId(nodeId)));
}

function resolveVisibleAncestorId(
	assets: IAsset[],
	assetId: string,
	visibleNodeIds: Set<string>
): string | null {
	if (visibleNodeIds.has(assetId)) {
		return assetId;
	}
	let current = assets.find((asset) => asset.id === assetId);
	const seen = new Set<string>();
	while (current && !seen.has(current.id)) {
		seen.add(current.id);
		if (visibleNodeIds.has(current.id)) {
			return current.id;
		}
		const ownerId = current.ownerIdRef?.trim();
		if (!ownerId) {
			break;
		}
		current = assets.find((asset) => asset.id === ownerId);
	}
	const rootId = resolveAssetStackRootId(assetId, assets);
	return visibleNodeIds.has(rootId) ? rootId : null;
}

function resolveLinkNodeId(
	assets: IAsset[],
	link: ILink,
	side: "from" | "to",
	visibleNodeIds: Set<string>
): string | null {
	const directId = resolveLinkSideAssetId(link, assets, side);
	if (!directId) {
		return null;
	}
	return resolveVisibleAncestorId(assets, directId, visibleNodeIds) ?? directId;
}

function pushGraphEdge(
	edges: ConnectionGraphEdge[],
	seen: Set<string>,
	assets: IAsset[],
	connection: IConnection,
	link: ILink,
	visibleNodeIds: Set<string>
) {
	const key = edgeKey(connection.id, String(link.id));
	if (seen.has(key)) {
		return;
	}

	const fromNodeId = resolveLinkNodeId(assets, link, "from", visibleNodeIds);
	const toNodeId = resolveLinkNodeId(assets, link, "to", visibleNodeIds);
	if (fromNodeId && toNodeId && fromNodeId === toNodeId) {
		return;
	}
	const isBridge = connection.kind === "bridge";
	if (!isBridge && (!fromNodeId || !toNodeId)) {
		return;
	}
	if (!isBridge && (!visibleNodeIds.has(fromNodeId!) || !visibleNodeIds.has(toNodeId!))) {
		return;
	}
	if (isBridge) {
		const stubId = `bridge-stub:${connection.peerEnvironmentRef || connection.bridgeId || connection.id}`;
		if (fromNodeId && visibleNodeIds.has(fromNodeId) && (!toNodeId || !visibleNodeIds.has(toNodeId))) {
			seen.add(key);
			edges.push({
				connectionId: connection.id,
				linkId: String(link.id),
				direction: resolveConnectionDirection(link.direction),
				label: link.title?.trim() || connection.definition?.label?.trim() || connection.id,
				fromNodeId,
				toNodeId: stubId,
				fromDockRef: link.fromDockRef?.trim() ?? "",
				toDockRef: link.toDockRef?.trim() ?? "",
			});
			return;
		}
		if (toNodeId && visibleNodeIds.has(toNodeId) && (!fromNodeId || !visibleNodeIds.has(fromNodeId))) {
			seen.add(key);
			edges.push({
				connectionId: connection.id,
				linkId: String(link.id),
				direction: resolveConnectionDirection(link.direction),
				label: link.title?.trim() || connection.definition?.label?.trim() || connection.id,
				fromNodeId: stubId,
				toNodeId,
				fromDockRef: link.fromDockRef?.trim() ?? "",
				toDockRef: link.toDockRef?.trim() ?? "",
			});
			return;
		}
	}

	if (!fromNodeId || !toNodeId) {
		return;
	}
	if (!visibleNodeIds.has(fromNodeId) || !visibleNodeIds.has(toNodeId)) {
		return;
	}

	seen.add(key);
	edges.push({
		connectionId: connection.id,
		linkId: String(link.id),
		direction: resolveConnectionDirection(link.direction),
		label: link.title?.trim() || connection.definition?.label?.trim() || connection.id,
		fromNodeId,
		toNodeId,
		fromDockRef: link.fromDockRef?.trim() ?? "",
		toDockRef: link.toDockRef?.trim() ?? "",
	});
}

export function collectConnectionGraphEdges(
	assets: IAsset[],
	connections: IConnection[],
	visibleNodeIds: Set<string>
): ConnectionGraphEdge[] {
	const edges: ConnectionGraphEdge[] = [];
	const seen = new Set<string>();

	for (const connection of connections) {
		for (const link of connection.links) {
			pushGraphEdge(edges, seen, assets, connection, link, visibleNodeIds);
		}
	}

	return edges;
}

function pushConnectionEdge(
	edges: ConnectionGraphEdge[],
	seenConnections: Set<string>,
	fromNodeId: string,
	toNodeId: string,
	connection: IConnection,
	link: IConnection["links"][number]
) {
	const key = edgeKey(connection.id, String(link.id));
	if (seenConnections.has(key)) {
		return;
	}
	seenConnections.add(key);
	edges.push({
		connectionId: connection.id,
		linkId: String(link.id),
		direction: resolveConnectionDirection(link.direction),
		label: link.title?.trim() || connection.definition?.label?.trim() || connection.id,
		fromNodeId,
		toNodeId,
		fromDockRef: link.fromDockRef?.trim() ?? "",
		toDockRef: link.toDockRef?.trim() ?? "",
	});
}

/** Walk visible tree nodes and resolve connections via dock endpoints (legacy graph behaviour). */
export function collectConnectionGraphEdgesFromTree(
	root: TreeElement,
	assets: IAsset[],
	connections: IConnection[],
	depth: number
): ConnectionGraphEdge[] {
	const edges: ConnectionGraphEdge[] = [];
	const seenConnections = new Set<string>();
	const connectionByEndpoint = new Map<string, IConnection>();
	for (const connection of connections) {
		for (const link of connection.links) {
			const fromRef = link.fromDockRef?.trim();
			const toRef = link.toDockRef?.trim();
			if (fromRef) {
				connectionByEndpoint.set(fromRef, connection);
				const fromDockId = parseDockRef(fromRef);
				if (fromDockId) {
					connectionByEndpoint.set(fromDockId, connection);
				}
			}
			if (toRef) {
				connectionByEndpoint.set(toRef, connection);
				const toDockId = parseDockRef(toRef);
				if (toDockId) {
					connectionByEndpoint.set(toDockId, connection);
				}
			}
		}
	}

	const seenNodes = new Set<string>();
	const walk = (node: TreeElement, remainingDepth: number) => {
		if (!node?.definition || seenNodes.has(node.id)) {
			return;
		}
		seenNodes.add(node.id);
		if (
			node.class === "Group" ||
			node.class === "Asset" ||
			node.class === "AssetDetails"
		) {
			if ("docks" in node && Array.isArray(node.docks)) {
				for (const dock of node.docks) {
					const dockId = String(dock.id);
					const connection = connectionByEndpoint.get(dockId);
					if (!connection) {
						continue;
					}
					const link = connection.links.find(
						(entry) =>
							parseDockRef(entry.fromDockRef) === dockId ||
							parseDockRef(entry.toDockRef) === dockId
					);
					if (!link) {
						continue;
					}
					const otherRef =
						parseDockRef(link.fromDockRef) === dockId
							? link.toDockRef
							: link.fromDockRef;
					if (!otherRef) {
						continue;
					}
					const otherAsset = findAssetByEndpointRef(assets, otherRef);
					if (!otherAsset) {
						continue;
					}
					const fromNodeId = node.id;
					const toNodeId = otherAsset.id;
					if (fromNodeId === toNodeId) {
						continue;
					}
					pushConnectionEdge(
						edges,
						seenConnections,
						fromNodeId,
						toNodeId,
						connection,
						link
					);
				}
			}
		}
		if (remainingDepth > 0 && typeof node.children === "function") {
			for (const child of node.children()) {
				if (child) {
					walk(child as TreeElement, remainingDepth - 1);
				}
			}
		}
	};

	walk(root, depth);
	return edges;
}

export function mergeConnectionGraphEdges(
	...edgeLists: ConnectionGraphEdge[][]
): ConnectionGraphEdge[] {
	const merged: ConnectionGraphEdge[] = [];
	const seen = new Set<string>();
	for (const edges of edgeLists) {
		for (const edge of edges) {
			const key = edgeKey(edge.connectionId, edge.linkId);
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);
			merged.push(edge);
		}
	}
	return merged;
}

export function collectVisibleAssetIdsFromTree(
	node: { id: string; class?: string; children?: () => Array<{ id: string; class?: string; children?: () => unknown[] } | null> },
	depth: number
): Set<string> {
	const ids = new Set<string>();
	const seen = new Set<string>();

	function walk(
		current: { id: string; class?: string; children?: () => Array<{ id: string; class?: string; children?: () => unknown[] } | null> },
		remaining: number
	) {
		if (!current || seen.has(current.id)) {
			return;
		}
		seen.add(current.id);
		if (
			current.class === "Asset" ||
			current.class === "AssetDetails" ||
			current.class === "Group"
		) {
			ids.add(current.id);
		}
		if (remaining > 0 && typeof current.children === "function") {
			for (const child of current.children()) {
				if (child) {
					walk(child as typeof current, remaining - 1);
				}
			}
		}
	}

	walk(node, depth);
	return ids;
}
