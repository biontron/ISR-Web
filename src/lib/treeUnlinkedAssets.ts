import { getIdentifier } from "mobx-state-tree";
import { IAsset } from "../Stores/Models/Asset.Model";
import { IGroup } from "../Stores/Models/Group.Model";
import { IRootStore } from "../Stores/Root.Store";

function resolveElementRefId(ref: { id: unknown }): string | undefined {
	if (typeof ref.id === "string" && ref.id.trim() !== "") {
		return ref.id.trim();
	}
	if (ref.id) {
		return getIdentifier(ref.id as IAsset) ?? undefined;
	}
	return undefined;
}

/** Alle View-Organisationsgruppen unter einer View (rekursiv über parentIdRef). */
export function collectViewGroupsUnderView(root: IRootStore, viewId: string): IGroup[] {
	const groups: IGroup[] = [];

	function walk(parentId: string) {
		for (const group of root.groups.groups) {
			if (group.parentIdRef === parentId) {
				groups.push(group);
				walk(group.id);
			}
		}
	}

	walk(viewId);
	return groups;
}

/** Asset-IDs, die statisch über elementIdRefs an View-Gruppen dieser View hängen. */
export function collectLinkedAssetIdsForView(root: IRootStore, viewId: string): Set<string> {
	const linked = new Set<string>();

	for (const group of collectViewGroupsUnderView(root, viewId)) {
		for (const ref of group.elementIdRefs) {
			const assetId = resolveElementRefId(ref);
			if (assetId) {
				linked.add(assetId);
			}
		}
	}

	return linked;
}

/** Komponenten ohne statische View-Group-Zuordnung (elementIdRefs) in der aktiven View. */
export function collectUnlinkedAssetsForView(root: IRootStore, viewId: string | undefined): IAsset[] {
	if (!viewId) {
		return [];
	}

	const linked = collectLinkedAssetIdsForView(root, viewId);
	return root.assets.assets.filter((asset) => !linked.has(asset.id));
}
