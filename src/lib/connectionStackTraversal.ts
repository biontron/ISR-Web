import { IAsset } from "../Stores/Models/Asset.Model";
import { IDock } from "../Stores/Models/Dock.Model";
import {
	formatDockEndpointRef,
	formatAssetDisplayName,
} from "./connectionEndpointRef";
import {
	PairedLinkpartSnapshot,
	pairSelectedDockparts,
	topDockpartIdFromSelection,
} from "./connectionDockpartPairing";
import { alignStackChains } from "./connectionStackChain";

export type DockSelectionByAsset = Map<string, string[]>;

export type StackLinkDraft = {
	fromAssetId: string;
	toAssetId: string;
	fromDockId: string;
	fromDockpartIds: string[];
	toDockId: string;
	toDockpartIds: string[];
};

export type BuiltLinkSnapshot = {
	fromComponentRef: string | null;
	fromDockRef: string;
	fromLabelSnapshot: string;
	toComponentRef: string | null;
	toDockRef: string;
	toLabelSnapshot: string;
	linkparts: PairedLinkpartSnapshot[];
};

function assetLabel(asset: IAsset | undefined): string {
	if (!asset) {
		return "";
	}
	return formatAssetDisplayName(asset);
}

export function collectStackLinkDrafts(
	fromChain: IAsset[],
	toChain: IAsset[],
	fromDockSelections: DockSelectionByAsset,
	toDockSelections: DockSelectionByAsset
): StackLinkDraft[] {
	const length = alignStackChains(fromChain, toChain);
	const drafts: StackLinkDraft[] = [];

	for (let index = 0; index < length; index++) {
		const fromAsset = fromChain[index];
		const toAsset = toChain[index];
		const fromDockIds = fromDockSelections.get(fromAsset.id) ?? [];
		const toDockIds = toDockSelections.get(toAsset.id) ?? [];

		for (const fromDockId of fromDockIds) {
			const fromDock = fromAsset.docks.find((dock) => String(dock.id) === String(fromDockId));
			if (!fromDock) {
				continue;
			}
			const fromDockpartIds = fromDock.dockparts.map((part) => String(part.id));
			if (fromDockpartIds.length === 0) {
				continue;
			}

			for (const toDockId of toDockIds) {
				const toDock = toAsset.docks.find((dock) => String(dock.id) === String(toDockId));
				if (!toDock) {
					continue;
				}
				const toDockpartIds = toDock.dockparts.map((part) => String(part.id));
				if (toDockpartIds.length === 0) {
					continue;
				}

				drafts.push({
					fromAssetId: fromAsset.id,
					toAssetId: toAsset.id,
					fromDockId: String(fromDock.id),
					fromDockpartIds,
					toDockId: String(toDock.id),
					toDockpartIds,
				});
			}
		}
	}

	return drafts;
}

export function buildLinkSnapshotFromDraft(
	assets: IAsset[],
	draft: StackLinkDraft
): BuiltLinkSnapshot | undefined {
	const fromAsset = assets.find((asset) => asset.id === draft.fromAssetId);
	const toAsset = assets.find((asset) => asset.id === draft.toAssetId);
	const fromDock = fromAsset?.docks.find((dock) => String(dock.id) === draft.fromDockId);
	const toDock = toAsset?.docks.find((dock) => String(dock.id) === draft.toDockId);
	if (!fromAsset || !toAsset || !fromDock || !toDock) {
		return undefined;
	}

	const { linkparts, unmatchedFromKeys } = pairSelectedDockparts(
		fromDock,
		draft.fromDockpartIds,
		toDock,
		draft.toDockpartIds
	);
	if (linkparts.length === 0) {
		if (unmatchedFromKeys.length > 0) {
			throw new Error(`Keine passenden Dockparts: ${unmatchedFromKeys.join(", ")}`);
		}
		return undefined;
	}

	const topFromId = topDockpartIdFromSelection(fromDock, draft.fromDockpartIds);
	const topToId = topDockpartIdFromSelection(toDock, draft.toDockpartIds);
	if (!topFromId || !topToId) {
		return undefined;
	}

	return {
		fromComponentRef: fromAsset.id,
		fromDockRef: formatDockEndpointRef(String(fromDock.id), topFromId),
		fromLabelSnapshot: assetLabel(fromAsset),
		toComponentRef: toAsset.id,
		toDockRef: formatDockEndpointRef(String(toDock.id), topToId),
		toLabelSnapshot: assetLabel(toAsset),
		linkparts,
	};
}

export function buildLinksFromStackDrafts(
	assets: IAsset[],
	drafts: StackLinkDraft[]
): BuiltLinkSnapshot[] {
	const links: BuiltLinkSnapshot[] = [];
	for (const draft of drafts) {
		const built = buildLinkSnapshotFromDraft(assets, draft);
		if (built) {
			links.push(built);
		}
	}
	return links;
}

export type SingleLinkpartsInput = {
	fromAssetId: string;
	fromDockId: string;
	fromDockpartIds: string[];
	toAssetId: string;
	toDockId: string;
	toDockpartIds: string[];
	includeAssetRefs?: boolean;
};

export function buildSingleLinkSnapshot(
	assets: IAsset[],
	input: SingleLinkpartsInput
): BuiltLinkSnapshot {
	const draft: StackLinkDraft = {
		fromAssetId: input.fromAssetId,
		toAssetId: input.toAssetId,
		fromDockId: input.fromDockId,
		fromDockpartIds: input.fromDockpartIds,
		toDockId: input.toDockId,
		toDockpartIds: input.toDockpartIds,
	};
	const built = buildLinkSnapshotFromDraft(assets, draft);
	if (!built) {
		throw new Error("Link konnte nicht aus Dockparts erzeugt werden.");
	}
	if (input.includeAssetRefs === false) {
		return {
			...built,
			fromComponentRef: null,
			toComponentRef: null,
		};
	}
	return built;
}
