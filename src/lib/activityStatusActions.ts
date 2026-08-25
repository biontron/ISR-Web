import { IRootStore } from "../Stores/Root.Store";
import { ElementStatus, IElement } from "../Stores/Models/Element.Model";
import { commitLocalEdit, isTouchedStatus } from "./elementStaging";
import {
	collectTouchedObjects,
	discardSelectedTouchedObjects,
	TouchedObjectRef,
	undoTouchedObject,
} from "./touchedObjects";
import {
	storeSelectedTouchedObjects,
	StoreSelectedResult,
} from "./storeTouchedObjects";

export function canSaveElementStatus(status?: ElementStatus): boolean {
	return !!status && ["edit", "changed", "new", "deleted", "invalid"].includes(status);
}

export function canDiscardElementStatus(status?: ElementStatus): boolean {
	return canSaveElementStatus(status);
}

/** Toolbar: Speichern/Verwerfen nur für das Active Element, nicht für Children. */
export function shouldEnableChangeModeSave(
	activeStatus: ElementStatus | undefined
): boolean {
	return canSaveElementStatus(activeStatus);
}

/** Nur das Active Element — geänderte Children bleiben ungespeichert. */
export function resolveChangeModeSaveRefs(
	root: IRootStore,
	activeElement: IElement | undefined
): TouchedObjectRef[] {
	if (!activeElement || !canSaveElementStatus(activeElement.status)) {
		return [];
	}
	const ref = findTouchedRefById(root, activeElement.id);
	return ref ? [ref] : [];
}

export function findTouchedRefById(
	root: IRootStore,
	elementId: string
): TouchedObjectRef | undefined {
	return collectTouchedObjects(root).find((ref) => ref.id === elementId);
}

/** Bearbeitungssitzung abschließen (edit → changed), ohne API-Call. */
export function finalizeLocalEdit(element: IElement): void {
	if (element.status === "edit") {
		commitLocalEdit(element);
	}
}

/** Speichern eines Elements — zentraler Pfad wie Activity Status Overview. */
export async function saveElement(
	root: IRootStore,
	element: IElement
): Promise<StoreSelectedResult> {
	finalizeLocalEdit(element);

	const ref = findTouchedRefById(root, element.id);
	if (!ref) {
		return { saved: 0, failed: [] };
	}

	return storeSelectedTouchedObjects(root, [ref]);
}

/** Verwerfen eines Elements — zentraler Pfad wie Activity Status Overview. */
export function discardElement(root: IRootStore, element: IElement): void {
	const ref = findTouchedRefById(root, element.id);
	if (ref) {
		undoTouchedObject(root, ref);
		return;
	}

	if (element.status === "edit") {
		element.rollbackEdit();
	}
}

export async function saveTouchedRefs(
	root: IRootStore,
	refs: TouchedObjectRef[]
): Promise<StoreSelectedResult> {
	for (const ref of refs) {
		finalizeLocalEdit(ref.element as IElement);
	}
	return storeSelectedTouchedObjects(root, refs);
}

export function discardTouchedRefs(root: IRootStore, refs: TouchedObjectRef[]): void {
	discardSelectedTouchedObjects(root, refs);
}

export function isElementStaged(status?: ElementStatus): boolean {
	return isTouchedStatus(status);
}
