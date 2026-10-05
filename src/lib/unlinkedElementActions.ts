/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0
*/
import { IAsset } from "../Stores/Models/Asset.Model";
import { IGroup } from "../Stores/Models/Group.Model";
import { IRootStore } from "../Stores/Root.Store";
import { isNewElementStatus, stageDelete } from "./elementStaging";
import { UnlinkedTreeElement } from "./treeUnlinkedAssets";

/** Markiert unverknüpfte Elemente zum Löschen. Neue Entwürfe werden sofort lokal entfernt. */
export function stageUnlinkedElementsForDelete(
	root: IRootStore,
	elements: readonly UnlinkedTreeElement[]
): number {
	let count = 0;
	for (const element of elements) {
		if (element.status === "deleted") {
			continue;
		}
		if (isNewElementStatus(element.status, element.statusBeforeInvalid)) {
			if (element.class === "Group") {
				root.groups.removeLocal(element as IGroup);
			} else if (element.class === "Asset") {
				root.assets.removeLocal(element as IAsset);
			}
			count += 1;
			continue;
		}
		stageDelete(element);
		count += 1;
	}
	return count;
}
