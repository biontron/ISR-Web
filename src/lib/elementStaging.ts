import { ElementStatus, IElement } from "../Stores/Models/Element.Model";

export function isTouchedStatus(status: ElementStatus | undefined): boolean {
	return !!status && status !== "untouched";
}

export function nextTouchedStatus(status: ElementStatus): ElementStatus {
	if (status === "new" || status === "invalid") {
		return status;
	}
	if (status === "edit" || status === "untouched") {
		return "changed";
	}
	return status;
}

export function touchKindFromStatus(
	status: ElementStatus,
	statusBeforeInvalid?: ElementStatus | null
): "create" | "update" | "delete" | null {
	const effectiveStatus =
		status === "invalid" && statusBeforeInvalid ? statusBeforeInvalid : status;

	switch (effectiveStatus) {
		case "new":
			return "create";
		case "edit":
		case "changed":
			return "update";
		case "deleted":
			return "delete";
		default:
			return null;
	}
}

export function isNewElementStatus(
	status: ElementStatus | undefined,
	statusBeforeInvalid?: ElementStatus | null
): boolean {
	return status === "new" || (status === "invalid" && statusBeforeInvalid === "new");
}

/** Volatile Felder — nicht in MST-getSnapshot enthalten. */
export interface ElementStagingState {
	status: ElementStatus;
	statusBeforeInvalid: ElementStatus | null;
}

export function captureElementStagingState(element: IElement): ElementStagingState {
	return {
		status: element.status,
		statusBeforeInvalid: element.statusBeforeInvalid,
	};
}

export function restoreElementStagingState(
	element: IElement,
	staging: ElementStagingState
): void {
	element.restoreStagingState(staging.status, staging.statusBeforeInvalid);
}

export function commitLocalEdit(element: IElement): void {
	element.commitLocalEdit();
}

export function stageDelete(element: IElement): void {
	element.stageDelete();
}

export function clearDeleteStaging(element: IElement): void {
	element.clearDeleteStaging();
}
