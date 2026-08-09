import { IAsset } from "../Stores/Models/Asset.Model";

/** Vorfahren-Kette von Wurzel bis Anker (ohne Nachfahren), via ownerIdRef. */
export function resolveAssetStackAncestorChain(anchorAssetId: string, assets: IAsset[]): IAsset[] {
	const anchor = assets.find((asset) => asset.id === anchorAssetId);
	if (!anchor) {
		return [];
	}

	const byId = new Map(assets.map((asset) => [asset.id, asset]));
	const chain: IAsset[] = [];
	const seen = new Set<string>();
	let current: IAsset | undefined = anchor;

	while (current) {
		if (seen.has(current.id)) {
			break;
		}
		seen.add(current.id);
		chain.unshift(current);
		const parentId: string | undefined = current.ownerIdRef?.trim() || undefined;
		current = parentId ? byId.get(parentId) : undefined;
	}

	return chain;
}

/** Lineare Asset-Kette von Wurzel (unten/ältester Vorfahre) bis Blatt (oben), via ownerIdRef. */
export function resolveAssetStackChain(anchorAssetId: string, assets: IAsset[]): IAsset[] {
	const anchor = assets.find((asset) => asset.id === anchorAssetId);
	if (!anchor) {
		return [];
	}

	const byId = new Map(assets.map((asset) => [asset.id, asset]));
	const ancestors: IAsset[] = [];
	const seen = new Set<string>();
	let current: IAsset | undefined = anchor;

	while (current) {
		if (seen.has(current.id)) {
			break;
		}
		seen.add(current.id);
		ancestors.unshift(current);
		const parentId: string | undefined = current.ownerIdRef?.trim() || undefined;
		current = parentId ? byId.get(parentId) : undefined;
	}

	const chain = [...ancestors];
	const collectDescendants = (parent: IAsset) => {
		const children = assets.filter((asset) => asset.ownerIdRef === parent.id);
		for (const child of children) {
			if (seen.has(child.id)) {
				continue;
			}
			seen.add(child.id);
			chain.push(child);
			collectDescendants(child);
		}
	};
	collectDescendants(anchor);

	return chain;
}

export function alignStackChains(fromChain: IAsset[], toChain: IAsset[]): number {
	return Math.min(fromChain.length, toChain.length);
}

export function formatAssetChainPreview(chain: IAsset[]): string {
	return chain
		.map((asset) => asset.definition?.name?.trim() || asset.definition?.label?.trim() || asset.id)
		.join(" → ");
}
