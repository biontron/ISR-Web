import { IAsset } from "../Stores/Models/Asset.Model";
import { IDock, IDockpart } from "../Stores/Models/Dock.Model";

export type SelectedDockpartRef = {
	dockId: string;
	dockpartId: string;
};

export type PairedLinkpartSnapshot = {
	fromLabelSnapshot: string;
	toLabelSnapshot: string;
	fromDockpartRef: string;
	toDockpartRef: string;
	stackOrder: number;
};

export type PairSelectedDockpartsResult = {
	linkparts: PairedLinkpartSnapshot[];
	unmatchedFromKeys: string[];
};

export function dockpartMatchKey(part: Pick<IDockpart, "protocol" | "type">): string | null {
	const protocol = part.protocol?.trim();
	if (protocol) {
		return protocol;
	}
	const type = part.type?.trim();
	if (type) {
		return type;
	}
	return null;
}

export function dockpartDisplayLabel(part: Pick<IDockpart, "label" | "type" | "protocol" | "id">): string {
	return part.label?.trim() || part.protocol?.trim() || part.type?.trim() || String(part.id);
}

function findDockpart(dock: IDock, dockpartId: string): IDockpart | undefined {
	return dock.dockparts.find((part) => String(part.id) === String(dockpartId));
}

export function sortDockpartsByBasedOn(dock: IDock, dockpartIds: string[]): string[] {
	const selectedIds = dockpartIds.map(String);
	const selectedSet = new Set(selectedIds);
	const inDegree = new Map<string, number>();
	const children = new Map<string, string[]>();

	for (const id of selectedIds) {
		inDegree.set(id, 0);
	}

	for (const id of selectedIds) {
		const part = findDockpart(dock, id);
		if (!part) {
			continue;
		}
		for (const entry of part.basedOn) {
			const parentId = String(entry.dockpartId);
			if (!selectedSet.has(parentId)) {
				continue;
			}
			inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
			const siblings = children.get(parentId) ?? [];
			siblings.push(id);
			children.set(parentId, siblings);
		}
	}

	const queue = selectedIds.filter((id) => (inDegree.get(id) ?? 0) === 0);
	const sorted: string[] = [];

	while (queue.length > 0) {
		const id = queue.shift();
		if (id == null) {
			break;
		}
		sorted.push(id);
		for (const childId of children.get(id) ?? []) {
			const nextDegree = (inDegree.get(childId) ?? 1) - 1;
			inDegree.set(childId, nextDegree);
			if (nextDegree === 0) {
				queue.push(childId);
			}
		}
	}

	for (const id of selectedIds) {
		if (!sorted.includes(id)) {
			sorted.push(id);
		}
	}

	return sorted;
}

export function collectMatchKeysFromAssetDockparts(asset: IAsset): Set<string> {
	const keys = new Set<string>();
	for (const dock of asset.docks) {
		for (const part of dock.dockparts) {
			const key = dockpartMatchKey(part);
			if (key) {
				keys.add(key);
			}
		}
	}
	return keys;
}

export function collectMatchKeysFromSelection(
	asset: IAsset,
	selection: SelectedDockpartRef[]
): Set<string> {
	const keys = new Set<string>();
	for (const entry of selection) {
		const dock = asset.docks.find((item) => String(item.id) === String(entry.dockId));
		const part = dock ? findDockpart(dock, entry.dockpartId) : undefined;
		if (!part) {
			continue;
		}
		const key = dockpartMatchKey(part);
		if (key) {
			keys.add(key);
		}
	}
	return keys;
}

export function assetHasMatchingDockpart(asset: IAsset, matchKeys: Set<string>): boolean {
	if (matchKeys.size === 0) {
		return false;
	}
	for (const dock of asset.docks) {
		for (const part of dock.dockparts) {
			const key = dockpartMatchKey(part);
			if (key && matchKeys.has(key)) {
				return true;
			}
		}
	}
	return false;
}

export function filterCompatibleTargetAssets(
	assets: IAsset[],
	currentAsset: IAsset,
	fromSelection: SelectedDockpartRef[]
): IAsset[] {
	const matchKeys = collectMatchKeysFromSelection(currentAsset, fromSelection);
	return assets.filter(
		(asset) => asset.id !== currentAsset.id && assetHasMatchingDockpart(asset, matchKeys)
	);
}

export function hasAnyCompatibleTargetAsset(assets: IAsset[], currentAsset: IAsset): boolean {
	const matchKeys = collectMatchKeysFromAssetDockparts(currentAsset);
	if (matchKeys.size === 0) {
		return false;
	}
	return assets.some(
		(asset) => asset.id !== currentAsset.id && assetHasMatchingDockpart(asset, matchKeys)
	);
}

export function assetHasBrowsableDockparts(asset: IAsset): boolean {
	return asset.docks.some((dock) => dock.dockparts.length > 0);
}

/** Wizard öffnen: kompatibles Ziel vorhanden oder anderes Asset mit Dockparts (z. B. neues Asset ohne Docks). */
export function canOpenConnectionSelectionDialog(
	assets: IAsset[],
	currentAsset: IAsset
): boolean {
	if (hasAnyCompatibleTargetAsset(assets, currentAsset)) {
		return true;
	}
	return assets.some(
		(asset) => asset.id !== currentAsset.id && assetHasBrowsableDockparts(asset)
	);
}

export function getCompatibleDockpartsForDock(
	dock: IDock,
	matchKeys: Set<string>
): IDockpart[] {
	return dock.dockparts.filter((part) => {
		const key = dockpartMatchKey(part);
		return !!key && matchKeys.has(key);
	});
}

export function pairSelectedDockparts(
	fromDock: IDock,
	fromDockpartIds: string[],
	toDock: IDock,
	toDockpartIds: string[]
): PairSelectedDockpartsResult {
	const sortedFromIds = sortDockpartsByBasedOn(fromDock, fromDockpartIds);
	const toByKey = new Map<string, IDockpart[]>();

	for (const toId of toDockpartIds) {
		const part = findDockpart(toDock, toId);
		if (!part) {
			continue;
		}
		const key = dockpartMatchKey(part);
		if (!key) {
			continue;
		}
		const bucket = toByKey.get(key) ?? [];
		bucket.push(part);
		toByKey.set(key, bucket);
	}

	const linkparts: PairedLinkpartSnapshot[] = [];
	const unmatchedFromKeys: string[] = [];

	sortedFromIds.forEach((fromId, index) => {
		const fromPart = findDockpart(fromDock, fromId);
		if (!fromPart) {
			return;
		}
		const key = dockpartMatchKey(fromPart);
		if (!key) {
			return;
		}
		const candidates = toByKey.get(key);
		const toPart = candidates?.shift();
		if (!toPart) {
			unmatchedFromKeys.push(key);
			return;
		}
		linkparts.push({
			fromLabelSnapshot: dockpartDisplayLabel(fromPart),
			toLabelSnapshot: dockpartDisplayLabel(toPart),
			fromDockpartRef: String(fromPart.id),
			toDockpartRef: String(toPart.id),
			stackOrder: index + 1,
		});
	});

	return { linkparts, unmatchedFromKeys };
}

export function topDockpartIdFromSelection(dock: IDock, dockpartIds: string[]): string | undefined {
	const sorted = sortDockpartsByBasedOn(dock, dockpartIds);
	return sorted[sorted.length - 1];
}

export function allDockpartIdsForDock(dock: IDock): string[] {
	return dock.dockparts.map((part) => String(part.id));
}

export function compatibleDockpartIdsForDock(dock: IDock, matchKeys: Set<string>): string[] {
	return getCompatibleDockpartsForDock(dock, matchKeys).map((part) => String(part.id));
}

export function orderDockpartsForDisplay(dock: IDock, parts: IDockpart[]): IDockpart[] {
	const ids = parts.map((part) => String(part.id));
	const sortedIds = sortDockpartsByBasedOn(dock, ids);
	return sortedIds
		.map((id) => parts.find((part) => String(part.id) === id))
		.filter((part): part is IDockpart => part != null);
}
