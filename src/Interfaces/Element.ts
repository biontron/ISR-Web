/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { IView } from "../Stores/Models/View.Model";
import { IGroup } from "../Stores/Models/Group.Model";
import { IAsset } from "../Stores/Models/Asset.Model";
import { getConnectionDisplayName, IConnection } from "../Stores/Models/Connection.Model";

export type ActiveElement = IAsset | IGroup | IView | IConnection | undefined;

/** Elemente im Asset-Baum (ohne Connection). */
export type TreeElement = IView | IGroup | IAsset;

export function isTreeElement(element: ActiveElement): element is TreeElement {
	return element != null && element.class !== "Connection";
}

export function getElementDisplayName(element: IView | IGroup | IAsset | IConnection): string {
	if (element.class === "Connection") {
		return getConnectionDisplayName(element as IConnection);
	}
	const treeElement = element as IView | IGroup | IAsset;
	return treeElement.definition.name ?? treeElement.id;
}
