import { TreeElement } from "../Interfaces/Element";
import { IAsset } from "../Stores/Models/Asset.Model";

export const GRAPH_STACK_CLUSTER_PREFIX = "__stack__";

/** Kein Abstand zwischen Stapel-Ebenen — Kästen direkt übereinander. */
export const STACK_LAYER_GAP = 0;
export const STACK_PARALLEL_GAP = 2;
export const STACK_PAD = 4;
export const STACK_COLUMN_GAP = 20;

export function graphStackClusterId(rootAssetId: string): string {
	return `${GRAPH_STACK_CLUSTER_PREFIX}${rootAssetId}`;
}

export function isGraphStackClusterId(nodeId: string | undefined): boolean {
	return !!nodeId && nodeId.startsWith(GRAPH_STACK_CLUSTER_PREFIX);
}

export function readAssetOwnerIdRef(element: TreeElement | IAsset): string | undefined {
	const owner =
		"ownerIdRef" in element ? (element as IAsset).ownerIdRef?.trim() : undefined;
	return owner || undefined;
}

export function isAssetStackChildOf(parent: TreeElement | IAsset, child: TreeElement | IAsset): boolean {
	return readAssetOwnerIdRef(child) === parent.id;
}

/** Asset ist Stapel-Root, wenn ownerIdRef leer ist oder auf kein anderes Asset zeigt. */
export function isAssetStackRoot(asset: IAsset, assets: ReadonlyArray<IAsset>): boolean {
	const ownerId = readAssetOwnerIdRef(asset);
	if (!ownerId) {
		return true;
	}
	return !assets.some((item) => item.id === ownerId);
}

export function isStackMemberAsset(
	element: TreeElement | IAsset,
	assets: ReadonlyArray<IAsset>
): boolean {
	if ("class" in element && element.class !== "Asset" && element.class !== "AssetDetails") {
		return false;
	}
	const ownerId = readAssetOwnerIdRef(element);
	if (!ownerId) {
		return false;
	}
	return assets.some((item) => item.id === ownerId);
}

export function resolveAssetStackRootId(assetId: string, assets: ReadonlyArray<IAsset>): string {
	let current = assets.find((item) => item.id === assetId);
	if (!current) {
		return assetId;
	}
	while (current) {
		const ownerId = readAssetOwnerIdRef(current);
		if (!ownerId) {
			break;
		}
		const owner = assets.find((item) => item.id === ownerId);
		if (!owner) {
			break;
		}
		current = owner;
	}
	return current.id;
}

function stackedAssetChildren(parent: IAsset, assets: ReadonlyArray<IAsset>): IAsset[] {
	return assets.filter((asset) => asset.ownerIdRef === parent.id);
}

/** Ebenenweise Stapel aus flacher Asset-Liste (zuverlässiger als Tree.children). */
export function collectAssetStackLayersFromAssets(
	root: IAsset,
	assets: ReadonlyArray<IAsset>
): IAsset[][] {
	const layers: IAsset[][] = [[root]];
	let currentLayer = [root];

	while (currentLayer.length > 0) {
		const nextLayer: IAsset[] = [];
		for (const parent of currentLayer) {
			nextLayer.push(...stackedAssetChildren(parent, assets));
		}
		if (nextLayer.length === 0) {
			break;
		}
		layers.push(nextLayer);
		currentLayer = nextLayer;
	}

	return layers;
}

export function collectAssetStackLayers(root: TreeElement): TreeElement[][] {
	const assets = root as unknown as IAsset;
	if (!assets.id) {
		return [[root]];
	}
	// Fallback für Tests ohne Store — nur direkte Tree-Kinder
	const layers: TreeElement[][] = [[root]];
	let currentLayer: TreeElement[] = [root];

	while (currentLayer.length > 0) {
		const nextLayer: TreeElement[] = [];
		for (const parent of currentLayer) {
			if (typeof parent.children !== "function") {
				continue;
			}
			for (const child of parent.children()) {
				if (!child) {
					continue;
				}
				const treeChild = child as TreeElement;
				if (isAssetStackChildOf(parent, treeChild)) {
					nextLayer.push(treeChild);
				}
			}
		}
		if (nextLayer.length === 0) {
			break;
		}
		layers.push(nextLayer);
		currentLayer = nextLayer;
	}

	return layers;
}

export function flattenAssetStackLayers<T extends { id: string }>(layers: T[][]): T[] {
	const seen = new Set<string>();
	const flat: T[] = [];
	for (const layer of layers) {
		for (const member of layer) {
			if (seen.has(member.id)) {
				continue;
			}
			seen.add(member.id);
			flat.push(member);
		}
	}
	return flat;
}

export function hasMultiLayerAssetStack(layers: { length: number }[]): boolean {
	return layers.length > 1 || (layers[0]?.length ?? 0) > 1;
}

export function findAssetStackRoots(assets: ReadonlyArray<IAsset>): IAsset[] {
	return assets.filter((asset) => isAssetStackRoot(asset, assets));
}
