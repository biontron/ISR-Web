import { resolveIdentifier } from "mobx-state-tree";
import { AssetModel } from "../Stores/Models/Asset.Model";
import { GroupModel } from "../Stores/Models/Group.Model";
import { ViewModel } from "../Stores/Models/View.Model";

/** Live-MST-Status — Tree-Nodes kopieren status sonst nur beim Aufbau. */
export function resolveElementLiveStatus(
	root: object,
	elementId: string | undefined
): string | undefined {
	if (!elementId) {
		return undefined;
	}
	const group = resolveIdentifier(GroupModel, root, elementId);
	if (group) {
		return group.status;
	}
	const asset = resolveIdentifier(AssetModel, root, elementId);
	if (asset) {
		return asset.status;
	}
	return resolveIdentifier(ViewModel, root, elementId)?.status;
}
