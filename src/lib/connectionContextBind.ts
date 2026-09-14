import { IAsset } from "../Stores/Models/Asset.Model";
import { matchingContextValuesForDockpart, ContextValue } from "./connectionContextValues";
import { isContextComponent } from "./connectionDevice";

export type ContextBindChoice = {
	fromAssetId: string;
	toContextId: string;
	fromDockId: string;
	fromDockpartId: string;
	contextValueId: string;
};

export type ContextBindResolution =
	| { status: "ready"; choice: ContextBindChoice }
	| { status: "needs-choice"; matches: ContextValue[]; fromDockId: string; fromDockpartId: string }
	| { status: "no-value" }
	| { status: "no-dockpart" };

export function resolveContextBind(
	asset: IAsset,
	context: IAsset,
	preferredDockpartId?: string
): ContextBindResolution {
	const parts: Array<{ dockId: string; part: IAsset["docks"][number]["dockparts"][number] }> = [];
	for (const dock of asset.docks) {
		for (const part of dock.dockparts) {
			if (preferredDockpartId && String(part.id) !== preferredDockpartId) {
				continue;
			}
			parts.push({ dockId: String(dock.id), part });
		}
	}
	if (parts.length === 0) {
		return { status: "no-dockpart" };
	}

	const first = parts[0];
	const matches = matchingContextValuesForDockpart([context], first.part);
	if (matches.length === 0) {
		return { status: "no-value" };
	}
	if (matches.length === 1) {
		return {
			status: "ready",
			choice: {
				fromAssetId: asset.id,
				toContextId: context.id,
				fromDockId: first.dockId,
				fromDockpartId: String(first.part.id),
				contextValueId: matches[0].valueId,
			},
		};
	}
	return {
		status: "needs-choice",
		matches,
		fromDockId: first.dockId,
		fromDockpartId: String(first.part.id),
	};
}

export function canDropAssetOnContextComponent(
	dragAsset: IAsset | undefined,
	dropAsset: IAsset | undefined,
	assets: ReadonlyArray<IAsset>
): boolean {
	if (!dragAsset || !dropAsset || dragAsset.id === dropAsset.id) {
		return false;
	}
	if (isContextComponent(dragAsset, assets)) {
		return false;
	}
	return isContextComponent(dropAsset, assets);
}
