import { TreeElement } from "../Interfaces/Element";
import { IAsset } from "../Stores/Models/Asset.Model";
import { IConnection, ILink } from "../Stores/Models/Connection.Model";
import {
	findAssetByEndpointRef,
	formatDockEndpointRef,
} from "./connectionEndpointRef";
import { resolveConnectionDirection } from "./connectionDirection";

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

function resolveAssetIdForDockRef(assets: IAsset[], dockRef: string): string | null {
	const asset = findAssetByEndpointRef(assets, dockRef);
	return asset?.id ?? null;
}

function resolveLinkNodeId(
	assets: IAsset[],
	link: ILink,
	side: "from" | "to"
): string | null {
	const componentRef = side === "from" ? link.fromComponentRef : link.toComponentRef;
	const trimmedComponentRef = componentRef?.trim();
	if (trimmedComponentRef) {
		return trimmedComponentRef;
	}
	const dockRef = (side === "from" ? link.fromDockRef : link.toDockRef)?.trim();
	if (!dockRef) {
		return null;
	}
	return resolveAssetIdForDockRef(assets, dockRef);
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

	const fromNodeId = resolveLinkNodeId(assets, link, "from");
	const toNodeId = resolveLinkNodeId(assets, link, "to");
	if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) {
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
			}
			if (toRef) {
				connectionByEndpoint.set(toRef, connection);
			}
		}
	}

	const walk = (node: TreeElement, remainingDepth: number) => {
		if (!node?.definition) {
			return;
		}
		if (
			node.class === "Group" ||
			node.class === "Asset" ||
			node.class === "AssetDetails"
		) {
			if ("docks" in node && Array.isArray(node.docks)) {
				for (const dock of node.docks) {
					for (const part of dock.dockparts ?? []) {
						const endpointRef = formatDockEndpointRef(String(dock.id), String(part.id));
						const connection = connectionByEndpoint.get(endpointRef);
						if (!connection) {
							continue;
						}
						const link = connection.links.find(
							(entry) =>
								entry.fromDockRef === endpointRef || entry.toDockRef === endpointRef
						);
						if (!link) {
							continue;
						}
						const otherRef =
							link.fromDockRef === endpointRef ? link.toDockRef : link.fromDockRef;
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
	if (!node) {
		return ids;
	}
	if (node.class === "Asset" || node.class === "AssetDetails") {
		ids.add(node.id);
	}
	if (depth > 0 && typeof node.children === "function") {
		for (const child of node.children()) {
			if (child) {
				collectVisibleAssetIdsFromTree(child as typeof node, depth - 1).forEach((id) => {
					ids.add(id);
				});
			}
		}
	}
	return ids;
}

export { formatDockEndpointRef };
