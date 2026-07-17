import { IAsset } from "../Stores/Models/Asset.Model";
import { dockpartMatchKey } from "./connectionDockpartPairing";

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
	toAssets: IAsset[]
): WizardDockpartMatch[] {
	const matches: WizardDockpartMatch[] = [];
	const seen = new Set<string>();

	for (const fromAsset of fromAssets) {
		for (const fromDock of fromAsset.docks) {
			for (const fromPart of fromDock.dockparts) {
				const matchKey = dockpartMatchKey(fromPart);
				if (!matchKey) {
					continue;
				}
				for (const toAsset of toAssets) {
					for (const toDock of toAsset.docks) {
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
