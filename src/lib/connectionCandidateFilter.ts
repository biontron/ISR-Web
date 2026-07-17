import { IAsset } from "../Stores/Models/Asset.Model";
import { resolveAssetElementType } from "./elementDefinitionTypes";
import { dockpartMatchKey } from "./connectionDockpartPairing";

export type ConnectionCandidateFilters = {
	searchText?: string;
	elementType?: string;
	subType?: string;
	protocol?: string;
};

export function assetDisplayName(asset: IAsset): string {
	return asset.definition?.name ?? asset.id;
}

export function collectDistinctElementTypes(assets: IAsset[]): string[] {
	const values = new Set<string>();
	for (const asset of assets) {
		const elementType = resolveAssetElementType(asset.definition);
		if (elementType) {
			values.add(elementType);
		}
	}
	return Array.from(values).sort();
}

export function collectDistinctSubTypes(assets: IAsset[], elementType?: string): string[] {
	const values = new Set<string>();
	for (const asset of assets) {
		if (elementType && resolveAssetElementType(asset.definition) !== elementType) {
			continue;
		}
		const subType = asset.definition?.subType?.trim();
		if (subType) {
			values.add(subType);
		}
	}
	return Array.from(values).sort();
}

export function collectDistinctProtocols(assets: IAsset[]): string[] {
	const values = new Set<string>();
	for (const asset of assets) {
		for (const dock of asset.docks) {
			for (const part of dock.dockparts) {
				const key = dockpartMatchKey(part);
				if (key) {
					values.add(key);
				}
			}
		}
	}
	return Array.from(values).sort();
}

export function assetHasProtocol(asset: IAsset, protocol: string): boolean {
	for (const dock of asset.docks) {
		for (const part of dock.dockparts) {
			if (dockpartMatchKey(part) === protocol) {
				return true;
			}
		}
	}
	return false;
}

export function filterConnectionCandidates(
	assets: IAsset[],
	filters: ConnectionCandidateFilters
): IAsset[] {
	const search = filters.searchText?.trim().toLowerCase() ?? "";
	return assets.filter((asset) => {
		if (filters.elementType && resolveAssetElementType(asset.definition) !== filters.elementType) {
			return false;
		}
		if (filters.subType && asset.definition?.subType !== filters.subType) {
			return false;
		}
		if (filters.protocol && !assetHasProtocol(asset, filters.protocol)) {
			return false;
		}
		if (!search) {
			return true;
		}
		const name = assetDisplayName(asset).toLowerCase();
		return name.includes(search) || asset.id.toLowerCase().includes(search);
	});
}
