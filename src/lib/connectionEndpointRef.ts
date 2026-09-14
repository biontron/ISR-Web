import { IAsset } from "../Stores/Models/Asset.Model";
import { resolveAssetElementType } from "./elementDefinitionTypes";
import { IConnection, ILink } from "../Stores/Models/Connection.Model";

export interface DockEndpointRef {
	dockId: string;
	dockpartId: string;
}

export interface EndpointLabelInfo {
	dockId: string;
	dockpartId: string;
	dockLabel: string;
	dockpartLabel: string;
}

const ENDPOINT_REF_SEPARATOR = "#";

export function formatDockEndpointRef(dockId: string, dockpartId: string): string {
	return `${dockId}${ENDPOINT_REF_SEPARATOR}${dockpartId}`;
}

export function parseDockEndpointRef(ref: string | undefined | null): DockEndpointRef | undefined {
	if (!ref || typeof ref !== "string") {
		return undefined;
	}
	const hashIndex = ref.indexOf(ENDPOINT_REF_SEPARATOR);
	if (hashIndex <= 0 || hashIndex >= ref.length - 1) {
		return undefined;
	}
	return {
		dockId: ref.slice(0, hashIndex),
		dockpartId: ref.slice(hashIndex + 1),
	};
}

/** Dock-ID aus fromDockRef / toDockRef. Legacy `dockId#dockpartId` wird nur gelesen. */
export function parseDockRef(ref: string | undefined | null): string | undefined {
	const trimmed = ref?.trim();
	if (!trimmed) {
		return undefined;
	}
	return parseDockEndpointRef(trimmed)?.dockId ?? trimmed;
}

export function resolveEndpointLabelInfo(
	assets: IAsset[],
	ref: string
): EndpointLabelInfo | undefined {
	const dockId = parseDockRef(ref);
	if (!dockId) {
		return undefined;
	}
	const dockpartId = parseDockEndpointRef(ref)?.dockpartId ?? "";
	for (const asset of assets) {
		for (const dock of asset.docks) {
			if (String(dock.id) !== dockId) {
				continue;
			}
			const part = dockpartId
				? dock.dockparts.find((entry) => String(entry.id) === dockpartId)
				: undefined;
			return {
				dockId,
				dockpartId,
				dockLabel: dock.label || dock.type || dockId,
				dockpartLabel: part ? part.label || part.type || dockpartId : "",
			};
		}
	}
	return undefined;
}

export function resolveDockpartLabelByRef(
	assets: IAsset[],
	dockpartRef: string
): string | undefined {
	const ref = dockpartRef.trim();
	if (!ref) {
		return undefined;
	}
	for (const asset of assets) {
		for (const dock of asset.docks) {
			for (const part of dock.dockparts) {
				if (String(part.id) === ref) {
					return part.label || part.type || ref;
				}
			}
		}
	}
	return undefined;
}

export interface ConnectionEndpointSide {
	ref: string;
	dockId: string;
	dockpartId: string;
	dockLabel: string;
	dockpartLabel: string;
	assetId: string;
	assetName: string;
	assetBaseType: string;
}

export function resolveConnectionEndpointSide(
	assets: IAsset[],
	ref: string
): ConnectionEndpointSide | undefined {
	const labels = resolveEndpointLabelInfo(assets, ref);
	if (!labels) {
		return undefined;
	}
	const asset = findAssetByEndpointRef(assets, ref);
	if (!asset) {
		return undefined;
	}
	return {
		ref,
		dockId: labels.dockId,
		dockpartId: labels.dockpartId,
		dockLabel: labels.dockLabel,
		dockpartLabel: labels.dockpartLabel,
		assetId: asset.id,
		assetName: asset.definition?.name ?? asset.id,
		assetBaseType: resolveAssetElementType(asset.definition),
	};
}

export function collectAllConnectableEndpoints(assets: IAsset[]): AssetDockEndpoint[] {
	const endpoints: AssetDockEndpoint[] = [];
	for (const asset of assets) {
		if (!assetHasConnectableEndpoint(asset)) {
			continue;
		}
		endpoints.push(...collectAssetDockEndpoints(asset));
	}
	return endpoints;
}

export function assetHasConnectableEndpoint(asset: IAsset): boolean {
	return asset.docks.some((dock) => dock.dockparts.length > 0);
}

export interface AssetDockEndpoint {
	asset: IAsset;
	dockId: string;
	dockpartId: string;
	ref: string;
	dockLabel: string;
	dockpartName: string;
	protocol: string;
}

export function collectAssetDockEndpoints(asset: IAsset): AssetDockEndpoint[] {
	const endpoints: AssetDockEndpoint[] = [];
	for (const dock of asset.docks) {
		for (const part of dock.dockparts) {
			endpoints.push({
				asset,
				dockId: String(dock.id),
				dockpartId: String(part.id),
				ref: formatDockEndpointRef(String(dock.id), String(part.id)),
				dockLabel: dock.label || dock.type || String(dock.id),
				dockpartName: part.label || part.type || String(part.id),
				protocol: part.protocol || "",
			});
		}
	}
	return endpoints;
}

function linkTouchesDockOrDockpart(link: ILink, ref: string): boolean {
	const needle = ref.trim();
	if (!needle) {
		return false;
	}
	if (link.fromDockRef === needle || link.toDockRef === needle) {
		return true;
	}
	const needleDock = parseDockRef(needle);
	if (
		needleDock &&
		(parseDockRef(link.fromDockRef) === needleDock || parseDockRef(link.toDockRef) === needleDock)
	) {
		return true;
	}
	const hashedPart = parseDockEndpointRef(needle)?.dockpartId;
	for (const part of link.linkparts) {
		if (part.fromDockpartRef === needle || part.toDockpartRef === needle) {
			return true;
		}
		if (hashedPart && (part.fromDockpartRef === hashedPart || part.toDockpartRef === hashedPart)) {
			return true;
		}
	}
	return false;
}

export function connectionTouchesEndpoint(connection: IConnection, ref: string): boolean {
	return connection.links.some((link) => linkTouchesDockOrDockpart(link, ref));
}

export function connectionTouchesAnyEndpoint(
	connection: IConnection,
	refs: Set<string>
): boolean {
	for (const ref of Array.from(refs)) {
		if (connectionTouchesEndpoint(connection, ref)) {
			return true;
		}
	}
	return false;
}

export function assetHasDockpartId(asset: IAsset, dockpartId: string | undefined | null): boolean {
	const id = dockpartId == null ? "" : String(dockpartId).trim();
	if (!id) {
		return false;
	}
	return asset.docks.some((dock) =>
		dock.dockparts.some((part) => String(part.id) === id)
	);
}

export function assetHasDockId(asset: IAsset, dockId: string | undefined | null): boolean {
	const id = dockId == null ? "" : String(dockId).trim();
	if (!id) {
		return false;
	}
	return asset.docks.some((dock) => String(dock.id) === id);
}

export type ConnectionSide = "from" | "to";

export function resolveLinkSideAssetId(
	link: ILink,
	assets: IAsset[],
	side: ConnectionSide
): string | undefined {
	const componentRef = side === "from" ? link.fromComponentRef : link.toComponentRef;
	const trimmedRef = componentRef?.trim();
	if (trimmedRef) {
		const byId = assets.find((asset) => asset.id === trimmedRef);
		if (byId) {
			return byId.id;
		}
		const byEndpoint = findAssetByEndpointRef(assets, trimmedRef);
		if (byEndpoint) {
			return byEndpoint.id;
		}
	}

	const dockRef = side === "from" ? link.fromDockRef : link.toDockRef;
	const byEndpoint = findAssetByEndpointRef(assets, dockRef);
	if (byEndpoint) {
		return byEndpoint.id;
	}

	const parsed = parseDockEndpointRef(dockRef);
	if (parsed) {
		const byDock = assets.find((candidate) => assetHasDockId(candidate, parsed.dockId));
		if (byDock) {
			return byDock.id;
		}
	}

	const partKey = side === "from" ? "fromDockpartRef" : "toDockpartRef";
	const scopedDock = parseDockEndpointRef(dockRef);
	for (const part of link.linkparts) {
		const partRef = part[partKey]?.trim();
		if (!partRef) {
			continue;
		}
		if (scopedDock) {
			const asset = assets.find((candidate) => assetHasDockId(candidate, scopedDock.dockId));
			const dock = asset?.docks.find((entry) => String(entry.id) === scopedDock.dockId);
			if (dock?.dockparts.some((entry) => String(entry.id) === partRef)) {
				return asset?.id;
			}
		}
		const byPart = findAssetByDockpartId(assets, partRef);
		if (byPart) {
			return byPart.id;
		}
	}

	return undefined;
}

function resolveSideAssetId(
	connection: IConnection,
	assets: IAsset[],
	side: ConnectionSide
): string | undefined {
	for (const link of connection.links) {
		const assetId = resolveLinkSideAssetId(link, assets, side);
		if (assetId) {
			return assetId;
		}
	}

	return undefined;
}

export function resolveConnectionFromAssetId(
	connection: IConnection,
	assets: IAsset[]
): string | undefined {
	return resolveSideAssetId(connection, assets, "from");
}

export function resolveConnectionToAssetId(
	connection: IConnection,
	assets: IAsset[]
): string | undefined {
	return resolveSideAssetId(connection, assets, "to");
}

export function resolveConnectionRelatedAssetIds(
	connection: IConnection,
	assets: IAsset[]
): Set<string> {
	const ids = new Set<string>();
	for (const link of connection.links) {
		const fromId = resolveLinkSideAssetId(link, assets, "from");
		const toId = resolveLinkSideAssetId(link, assets, "to");
		if (fromId) {
			ids.add(fromId);
		}
		if (toId) {
			ids.add(toId);
		}
	}
	return ids;
}

export function formatAssetDisplayName(asset: IAsset | undefined, fallback = "—"): string {
	if (!asset) {
		return fallback;
	}
	return asset.definition?.name?.trim() || asset.definition?.label?.trim() || asset.id;
}

export function formatConnectionSideSummary(
	connection: IConnection,
	assets: IAsset[],
	side: ConnectionSide,
	groups?: ReadonlyArray<{ id: string; definition?: { name?: string; label?: string } }>
): string {
	for (const link of connection.links) {
		const snapshot =
			side === "from" ? link.fromLabelSnapshot?.trim() : link.toLabelSnapshot?.trim();
		if (snapshot) {
			return snapshot;
		}

		const dockRef = side === "from" ? link.fromDockRef : link.toDockRef;
		const resolved = dockRef?.trim()
			? resolveConnectionEndpointSide(assets, dockRef)
			: undefined;
		if (resolved) {
			return [resolved.assetName, resolved.dockLabel, resolved.dockpartLabel]
				.filter(Boolean)
				.join(" · ");
		}
		if (dockRef?.trim()) {
			return dockRef.trim();
		}
	}

	const assetId = resolveSideAssetId(connection, assets, side);
	if (assetId) {
		const asset = assets.find((candidate) => candidate.id === assetId);
		if (asset) {
			return formatAssetDisplayName(asset, assetId);
		}
		const group = groups?.find((entry) => entry.id === assetId);
		if (group) {
			return group.definition?.name?.trim() || group.definition?.label?.trim() || assetId;
		}
		return assetId;
	}

	return "—";
}

/** Prüft, ob eine Connection an irgendeinem Dock/Dockpart des Assets hängt. */
export function connectionTouchesAsset(
	connection: IConnection,
	asset: IAsset,
	allAssets?: IAsset[]
): boolean {
	const assets = allAssets?.length ? allAssets : [asset];
	return resolveConnectionRelatedAssetIds(connection, assets).has(asset.id);
}

export function findAssetByDockpartId(
	assets: IAsset[],
	dockpartId: string
): IAsset | undefined {
	return assets.find((asset) =>
		asset.docks.some((dock) =>
			dock.dockparts.some((part) => String(part.id) === String(dockpartId))
		)
	);
}

export function findAssetByEndpointRef(
	assets: IAsset[],
	ref: string
): IAsset | undefined {
	const parsed = parseDockEndpointRef(ref);
	if (parsed) {
		const byDockAndPart = assets.find((asset) =>
			asset.docks.some(
				(dock) =>
					String(dock.id) === parsed.dockId &&
					dock.dockparts.some((part) => String(part.id) === parsed.dockpartId)
			)
		);
		if (byDockAndPart) {
			return byDockAndPart;
		}
		return assets.find((asset) => assetHasDockId(asset, parsed.dockId));
	}
	const byDock = assets.find((asset) => assetHasDockId(asset, ref));
	if (byDock) {
		return byDock;
	}
	return findAssetByDockpartId(assets, ref);
}
