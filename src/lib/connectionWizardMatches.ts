import { IAsset } from "../Stores/Models/Asset.Model";
import { dockpartMatchKey } from "./connectionDockpartPairing";
import { getEffectiveDocks } from "./effectiveDockparts";
import { StackLinkDraft } from "./connectionStackTraversal";
import { IGroup } from "../Stores/Models/Group.Model";

export type DockpartLocator = {
	assetId: string;
	dockId: string;
	dockpartId: string;
};

export type WizardDockpartMatch = {
	matchKey: string;
	from: DockpartLocator;
	to: DockpartLocator;
};

export type WizardDockpartSelection = DockpartLocator;

export function dockpartLocatorKey(locator: DockpartLocator): string {
	return `${locator.assetId}:${locator.dockId}:${locator.dockpartId}`;
}

export function isDockpartSelected(
	selection: WizardDockpartSelection[],
	locator: DockpartLocator
): boolean {
	const key = dockpartLocatorKey(locator);
	return selection.some((entry) => dockpartLocatorKey(entry) === key);
}

export function toggleDockpartSelection(
	selection: WizardDockpartSelection[],
	locator: DockpartLocator,
	checked: boolean
): WizardDockpartSelection[] {
	const key = dockpartLocatorKey(locator);
	if (!checked) {
		return selection.filter((entry) => dockpartLocatorKey(entry) !== key);
	}
	if (selection.some((entry) => dockpartLocatorKey(entry) === key)) {
		return selection;
	}
	return [...selection, locator];
}

export function collectWizardDockpartMatches(
	fromAssets: IAsset[],
	toAssets: IAsset[],
	allAssets: IAsset[] = [...fromAssets, ...toAssets],
	allGroups: IGroup[] = []
): WizardDockpartMatch[] {
	const matches: WizardDockpartMatch[] = [];
	const seen = new Set<string>();

	for (const fromAsset of fromAssets) {
		for (const fromDock of getEffectiveDocks(fromAsset, allAssets, allGroups)) {
			for (const fromPart of fromDock.dockparts) {
				const matchKey = dockpartMatchKey(fromPart);
				if (!matchKey) {
					continue;
				}
				for (const toAsset of toAssets) {
					for (const toDock of getEffectiveDocks(toAsset, allAssets, allGroups)) {
						for (const toPart of toDock.dockparts) {
							if (dockpartMatchKey(toPart) !== matchKey) {
								continue;
							}
							const from: DockpartLocator = {
								assetId: fromAsset.id,
								dockId: String(fromDock.id),
								dockpartId: String(fromPart.id),
							};
							const to: DockpartLocator = {
								assetId: toAsset.id,
								dockId: String(toDock.id),
								dockpartId: String(toPart.id),
							};
							const id = `${dockpartLocatorKey(from)}->${dockpartLocatorKey(to)}`;
							if (seen.has(id)) {
								continue;
							}
							seen.add(id);
							matches.push({ matchKey, from, to });
						}
					}
				}
			}
		}
	}

	return matches;
}

export function resolveActiveWizardMatches(
	matches: WizardDockpartMatch[],
	fromSelection: WizardDockpartSelection[],
	toSelection: WizardDockpartSelection[]
): WizardDockpartMatch[] {
	return matches.filter(
		(match) =>
			isDockpartSelected(fromSelection, match.from) &&
			isDockpartSelected(toSelection, match.to)
	);
}

export function wizardMatchId(match: WizardDockpartMatch): string {
	return `${dockpartLocatorKey(match.from)}->${dockpartLocatorKey(match.to)}`;
}

function dockPairKey(from: DockpartLocator, to: DockpartLocator): string {
	return `${from.assetId}|${from.dockId}::${to.assetId}|${to.dockId}`;
}

/** Baut Stack-Drafts aus aktiven Wizard-Pairings (pro Dock-Paar die selektierten Dockparts). */
export function buildStackDraftsFromActiveMatches(
	activeMatches: WizardDockpartMatch[]
): StackLinkDraft[] {
	const groups = new Map<
		string,
		{
			fromAssetId: string;
			toAssetId: string;
			fromDockId: string;
			toDockId: string;
			fromDockpartIds: Set<string>;
			toDockpartIds: Set<string>;
		}
	>();

	for (const match of activeMatches) {
		const key = dockPairKey(match.from, match.to);
		let group = groups.get(key);
		if (!group) {
			group = {
				fromAssetId: match.from.assetId,
				toAssetId: match.to.assetId,
				fromDockId: match.from.dockId,
				toDockId: match.to.dockId,
				fromDockpartIds: new Set<string>(),
				toDockpartIds: new Set<string>(),
			};
			groups.set(key, group);
		}
		group.fromDockpartIds.add(match.from.dockpartId);
		group.toDockpartIds.add(match.to.dockpartId);
	}

	return Array.from(groups.values()).map((group) => ({
		fromAssetId: group.fromAssetId,
		toAssetId: group.toAssetId,
		fromDockId: group.fromDockId,
		fromDockpartIds: Array.from(group.fromDockpartIds),
		toDockId: group.toDockId,
		toDockpartIds: Array.from(group.toDockpartIds),
	}));
}

export function shouldUseStackPathConnection(drafts: StackLinkDraft[]): boolean {
	if (drafts.length === 0) {
		return false;
	}
	if (drafts.length > 1) {
		return true;
	}
	const draft = drafts[0];
	return draft.fromAssetId !== draft.toAssetId;
}
