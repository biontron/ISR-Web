import { getSnapshot } from "mobx-state-tree";
import { IRootStore } from "../Stores/Root.Store";
import { TouchedObjectRef } from "./touchedObjects";

/** MST-Snapshot → REST-Schreib-Body für Activity-Status-Vorschau. */
export function restWritePayloadForRef(
	root: IRootStore,
	ref: TouchedObjectRef
): unknown {
	return getSnapshot(ref.element);
}

export function stringifyRestBody(payload: unknown): { body?: string; error?: string } {
	try {
		return { body: JSON.stringify(payload) };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
