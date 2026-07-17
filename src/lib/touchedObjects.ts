import { IRootStore } from "../Stores/Root.Store";
import { ElementStatus, IElement } from "../Stores/Models/Element.Model";
import { IView } from "../Stores/Models/View.Model";
import { IGroup } from "../Stores/Models/Group.Model";
import { IAsset } from "../Stores/Models/Asset.Model";
import { getConnectionDisplayName, IConnection } from "../Stores/Models/Connection.Model";
import { isTouchedStatus, touchKindFromStatus } from "./elementStaging";

export type TouchedObjectKind = "View" | "Group" | "Asset" | "Connection";

export interface TouchedObjectRef {
	id: string;
	kind: TouchedObjectKind;
	touch: "create" | "update" | "delete";
	name: string;
	status: ElementStatus;
	element: IView | IGroup | IAsset | IConnection;
}

function elementName(element: IView | IGroup | IAsset | IConnection): string {
	if (element.class === "Connection") {
		return getConnectionDisplayName(element as IConnection);
	}
	const treeElement = element as IView | IGroup | IAsset;
	return treeElement.definition?.name ?? treeElement.id;
}

function pushIfTouched(
	pending: TouchedObjectRef[],
	element: IView | IGroup | IAsset | IConnection,
	kind: TouchedObjectKind
): void {
	if (!isTouchedStatus(element.status)) {
		return;
	}
	const touch = touchKindFromStatus(element.status, element.statusBeforeInvalid);
	if (!touch) {
		return;
	}
	pending.push({
		id: element.id,
		kind,
		touch,
		name: elementName(element),
		status: element.status,
		element,
	});
}

export function collectTouchedObjects(root: IRootStore): TouchedObjectRef[] {
	const pending: TouchedObjectRef[] = [];

	for (const view of root.views.views) {
		pushIfTouched(pending, view, "View");
	}
	for (const group of root.groups.groups) {
		pushIfTouched(pending, group, "Group");
	}
	for (const asset of root.assets.assets) {
		pushIfTouched(pending, asset, "Asset");
	}
	for (const connection of root.connections.connections) {
		pushIfTouched(pending, connection, "Connection");
	}

	return pending;
}

export function hasTouchedObjects(root: IRootStore): boolean {
	return collectTouchedObjects(root).length > 0;
}

function removeFromStore(root: IRootStore, ref: TouchedObjectRef): void {
	switch (ref.kind) {
		case "View":
			root.views.removeLocal(ref.element as IView);
			break;
		case "Group":
			root.groups.removeLocal(ref.element as IGroup);
			break;
		case "Asset":
			root.assets.removeLocal(ref.element as IAsset);
			break;
		case "Connection":
			root.connections.removeLocal(ref.element as IConnection);
			break;
	}
}

export function undoTouchedObject(root: IRootStore, ref: TouchedObjectRef): void {
	const element = ref.element as IElement;

	switch (ref.touch) {
		case "create":
			removeFromStore(root, ref);
			break;
		case "update":
			element.rollbackEdit();
			break;
		case "delete":
			element.clearDeleteStaging();
			break;
	}
}

export function discardSelectedTouchedObjects(root: IRootStore, refs: TouchedObjectRef[]): void {
	for (const ref of refs) {
		undoTouchedObject(root, ref);
	}
}

/** @deprecated use collectTouchedObjects */
export const collectPendingElements = collectTouchedObjects;
/** @deprecated use hasTouchedObjects */
export const hasPendingElementChanges = hasTouchedObjects;

export type PendingElementRef = TouchedObjectRef;
export type PendingElementClass = TouchedObjectKind;
