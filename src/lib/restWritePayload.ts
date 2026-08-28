import { getSnapshot } from "mobx-state-tree";
import { IRootStore } from "../Stores/Root.Store";
import { TouchedObjectRef } from "./touchedObjects";
import { rewriteFilterRulesInSnapshot } from "./filterRuleNormalize";

/** MST-Snapshot → REST-Schreib-Body für Activity-Status-Vorschau. */
export function restWritePayloadForRef(
	root: IRootStore,
	ref: TouchedObjectRef
): unknown {
	const snapshot = getSnapshot(ref.element);
	if (ref.kind === "Group" || ref.kind === "View") {
		return rewriteFilterRulesInSnapshot(snapshot);
	}
	return snapshot;
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
