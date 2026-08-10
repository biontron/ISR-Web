import { IAsset } from "../Stores/Models/Asset.Model";
import { IDock, IDockpart } from "../Stores/Models/Dock.Model";
import { parseDockEndpointRef } from "./connectionEndpointRef";

/**
 * Auflösung von basedOn-Ketten (Protokoll-Stack zwischen Dockparts/Components).
 * Kontext-Werte (VLAN-ID aus Kontext-Gruppe) werden hier nicht modelliert —
 * siehe valueReferenceResolve / Documents/Connection-Stack-Architektur.md
 */

export type BasedOnEntry = {
	dockpartId?: string | number;
	componentRef?: string;
	externalDockpartRef?: string;
};

export type ResolvedDockpartLayer = {
	dockpart: IDockpart;
	sourceAssetId: string;
	sourceDockId: string;
	depth: number;
};

function findDockpartInAsset(
	asset: IAsset,
	dockpartId: string
): { dock: IDock; part: IDockpart } | undefined {
	for (const dock of asset.docks) {
		for (const part of dock.dockparts) {
			if (String(part.id) === dockpartId) {
				return { dock, part };
			}
		}
	}
	return undefined;
}

function findDockpartByExternalRef(
	assets: IAsset[],
	externalDockpartRef: string
): { asset: IAsset; dock: IDock; part: IDockpart } | undefined {
	const parsed = parseDockEndpointRef(externalDockpartRef);
	if (!parsed) {
		return undefined;
	}
	for (const asset of assets) {
		for (const dock of asset.docks) {
			if (String(dock.id) !== parsed.dockId) {
				continue;
			}
			for (const part of dock.dockparts) {
				if (String(part.id) === parsed.dockpartId) {
					return { asset, dock, part };
				}
			}
		}
	}
	return undefined;
}

function readBasedOnEntries(part: IDockpart): BasedOnEntry[] {
	return (part.basedOn ?? []).map((entry) => ({
		dockpartId: entry.dockpartId,
		componentRef: (entry as BasedOnEntry).componentRef,
		externalDockpartRef: (entry as BasedOnEntry).externalDockpartRef,
	}));
}

export function resolveBasedOnParent(
	entry: BasedOnEntry,
	currentAsset: IAsset,
	currentDock: IDock,
	assets: IAsset[]
): { asset: IAsset; dock: IDock; part: IDockpart } | undefined {
	if (entry.dockpartId != null && String(entry.dockpartId).trim() !== "") {
		const local = findDockpartInAsset(currentAsset, String(entry.dockpartId));
		if (local) {
			return { asset: currentAsset, dock: local.dock, part: local.part };
		}
	}

	if (entry.externalDockpartRef?.trim()) {
		const external = findDockpartByExternalRef(assets, entry.externalDockpartRef.trim());
		if (external) {
			return external;
		}
	}

	if (entry.componentRef?.trim()) {
		const componentAsset = assets.find((asset) => asset.id === entry.componentRef?.trim());
		if (!componentAsset) {
			return undefined;
		}
		if (entry.dockpartId != null && String(entry.dockpartId).trim() !== "") {
			const match = findDockpartInAsset(componentAsset, String(entry.dockpartId));
			if (match) {
				return { asset: componentAsset, dock: match.dock, part: match.part };
			}
		}
		const firstPart = componentAsset.docks.flatMap((dock) =>
			dock.dockparts.map((part) => ({ dock, part }))
		)[0];
		if (firstPart) {
			return { asset: componentAsset, dock: firstPart.dock, part: firstPart.part };
		}
	}

	return undefined;
}

export function resolveDockpartLayerStack(
	part: IDockpart,
	asset: IAsset,
	dock: IDock,
	assets: IAsset[],
	visited = new Set<string>()
): ResolvedDockpartLayer[] {
	const partId = String(part.id);
	if (visited.has(partId)) {
		return [{ dockpart: part, sourceAssetId: asset.id, sourceDockId: String(dock.id), depth: 0 }];
	}
	visited.add(partId);

	const entries = readBasedOnEntries(part);
	if (entries.length === 0) {
		return [{ dockpart: part, sourceAssetId: asset.id, sourceDockId: String(dock.id), depth: 0 }];
	}

	const layers: ResolvedDockpartLayer[] = [];
	for (const entry of entries) {
		const parent = resolveBasedOnParent(entry, asset, dock, assets);
		if (!parent) {
			continue;
		}
		const parentLayers = resolveDockpartLayerStack(
			parent.part,
			parent.asset,
			parent.dock,
			assets,
			visited
		);
		layers.push(...parentLayers);
	}

	layers.push({
		dockpart: part,
		sourceAssetId: asset.id,
		sourceDockId: String(dock.id),
		depth: layers.length,
	});

	return layers;
}

export function flattenDockStackLayers(
	dock: IDock,
	asset: IAsset,
	assets: IAsset[]
): ResolvedDockpartLayer[] {
	const result: ResolvedDockpartLayer[] = [];
	const seen = new Set<string>();

	for (const part of dock.dockparts) {
		const stack = resolveDockpartLayerStack(part, asset, dock, assets);
		for (const layer of stack) {
			const key = `${layer.sourceAssetId}:${layer.sourceDockId}:${layer.dockpart.id}`;
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);
			result.push(layer);
		}
	}

	return result.sort((a, b) => a.depth - b.depth);
}

export function sortDockpartsByResolvedStack(
	dock: IDock,
	asset: IAsset,
	assets: IAsset[],
	dockpartIds: string[]
): string[] {
	const layers = dockpartIds
		.map((id) => {
			const part = dock.dockparts.find((entry) => String(entry.id) === id);
			if (!part) {
				return undefined;
			}
			const stack = resolveDockpartLayerStack(part, asset, dock, assets);
			return { id, depth: stack[stack.length - 1]?.depth ?? 0 };
		})
		.filter((entry): entry is { id: string; depth: number } => entry != null);

	return layers.sort((a, b) => a.depth - b.depth).map((entry) => entry.id);
}
