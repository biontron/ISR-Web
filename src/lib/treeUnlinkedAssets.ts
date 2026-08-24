import { IAsset } from "../Stores/Models/Asset.Model";
import { IGroup } from "../Stores/Models/Group.Model";
import { IRootStore } from "../Stores/Root.Store";
import { resolveElementRefId } from "./elementChildLinks";
import { assetMatchesAnyFilterRule } from "./filterRulesMatch";

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

function addAssetAndOwnerDescendants(
	root: IRootStore,
	assetId: string,
	linked: Set<string>
) {
	if (!assetId || linked.has(assetId)) {
		return;
	}
	linked.add(assetId);
	for (const asset of root.assets.assets) {
		if (asset.ownerIdRef === assetId) {
			addAssetAndOwnerDescendants(root, asset.id, linked);
		}
	}
}

/**
 * Asset-IDs, die in der aktiven View im Baum hängen:
 * Child-Ref (elementIdRefs), Parent-Ref (ownerIdRef auf Gruppe oder Stapel),
 * XPath/filterRules an View-Gruppen, plus rekursive ownerIdRef-Nachfahren.
 */
export function collectLinkedAssetIdsForView(root: IRootStore, viewId: string): Set<string> {
	const linked = new Set<string>();

	for (const group of collectViewGroupsUnderView(root, viewId)) {
		for (const ref of group.elementIdRefs) {
			const assetId = resolveElementRefId(ref);
			if (assetId) {
				addAssetAndOwnerDescendants(root, assetId, linked);
			}
		}

		for (const asset of root.assets.assets) {
			if (asset.ownerIdRef === group.id) {
				addAssetAndOwnerDescendants(root, asset.id, linked);
			}
		}

		for (const asset of root.assets.assets) {
			if (assetMatchesAnyFilterRule(asset, group.filterRules)) {
				addAssetAndOwnerDescendants(root, asset.id, linked);
			}
		}
	}

	return linked;
}

/** Komponenten ohne Zuordnung (Parent-Ref, Child-Ref oder XPath) in der aktiven View. */
export function collectUnlinkedAssetsForView(root: IRootStore, viewId: string | undefined): IAsset[] {
	if (!viewId) {
		return [];
	}

	const linked = collectLinkedAssetIdsForView(root, viewId);
	return root.assets.assets.filter((asset) => !linked.has(asset.id));
}
