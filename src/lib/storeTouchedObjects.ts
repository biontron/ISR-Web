import api from "./api";
import { IRootStore } from "../Stores/Root.Store";
import { IElement } from "../Stores/Models/Element.Model";
import { IView } from "../Stores/Models/View.Model";
import { IGroup } from "../Stores/Models/Group.Model";
import { IAsset } from "../Stores/Models/Asset.Model";
import { IConnection } from "../Stores/Models/Connection.Model";
import { IEnvironment } from "../Stores/Models/Environment.Model";
import { buildRestRequestForTouchedObject } from "./restRequestForTouchedObject";
import { syncElementValidationStatus } from "./elementSchemaValidation";
import { collectTouchedObjects, TouchedObjectRef } from "./touchedObjects";
import {
	touchedObjectErrorRegistry,
	TouchedObjectStoreFailure,
} from "./touchedObjectErrors";
import { buildStoreFailureDetails, serializeResponseHeaders } from "./storeFailureFormat";
import { stringifyRestBody } from "./restWritePayload";

export interface StoreSelectedResult {
	saved: number;
	failed: TouchedObjectStoreFailure[];
}

const STORE_PHASE_ORDER: Array<{ touch: TouchedObjectRef["touch"]; kinds: TouchedObjectRef["kind"][] }> = [
	{ touch: "create", kinds: ["EditorSchema", "DockpartSchema"] },
	{ touch: "update", kinds: ["EditorSchema", "DockpartSchema"] },
	{ touch: "create", kinds: ["Asset", "Group", "View"] },
	{ touch: "update", kinds: ["Environment"] },
	{ touch: "update", kinds: ["Asset", "Group", "View"] },
	{ touch: "create", kinds: ["Connection"] },
	{ touch: "update", kinds: ["Connection"] },
	{ touch: "delete", kinds: ["Connection", "Asset", "Group", "View"] },
];

function sortForStore(refs: TouchedObjectRef[]): TouchedObjectRef[] {
	const orderIndex = (ref: TouchedObjectRef): number => {
		for (let i = 0; i < STORE_PHASE_ORDER.length; i++) {
			const phase = STORE_PHASE_ORDER[i];
			if (phase.touch === ref.touch && phase.kinds.includes(ref.kind)) {
				return i * 100 + phase.kinds.indexOf(ref.kind);
			}
		}
		return 999;
	};
	return [...refs].sort((a, b) => orderIndex(a) - orderIndex(b));
}

function removeAfterDelete(root: IRootStore, ref: TouchedObjectRef): void {
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
		case "EditorSchema":
		case "DockpartSchema":
			root.configSchemas.removeStagedSchema(
				ref.element as Parameters<IRootStore["configSchemas"]["removeStagedSchema"]>[0]
			);
			break;
		case "Environment":
			break;
	}
}

function syncTouchedValidation(root: IRootStore, ref: TouchedObjectRef): void {
	if (ref.kind === "Environment") {
		return;
	}
	syncElementValidationStatus(root, ref.element as IElement);
}

function onStoreSuccess(root: IRootStore, ref: TouchedObjectRef): void {
	touchedObjectErrorRegistry.clear(ref.id);
	if (ref.kind === "Environment") {
		(ref.element as IEnvironment).commitIgnoredDevices();
		return;
	}

	const element = ref.element as IElement;

	if (ref.touch === "delete") {
		removeAfterDelete(root, ref);
		return;
	}

	element.commitEdit();
	syncTouchedValidation(root, ref);
}

async function storeSingleRef(
	root: IRootStore,
	ref: TouchedObjectRef
): Promise<{ ok: boolean; failure?: TouchedObjectStoreFailure }> {
	const request = buildRestRequestForTouchedObject(root, ref);

	const serialized = request.payload
		? stringifyRestBody(request.payload)
		: { body: undefined as string | undefined };

	if (serialized.error) {
		const details = buildStoreFailureDetails(
			new Error(`JSON-Serialisierung fehlgeschlagen: ${serialized.error}`),
			request
		);
		const failure: TouchedObjectStoreFailure = {
			ref,
			request,
			message: details.message,
			isNetworkError: false,
		};
		touchedObjectErrorRegistry.setFailure(failure);
		syncTouchedValidation(root, ref);
		return { ok: false, failure };
	}

	try {
		const response = await api.request(request.path, {
			method: request.method,
			body: serialized.body,
		});

		if (!response.ok) {
			const responseBody = await response.text();
			const responseHeaders = serializeResponseHeaders(response.headers);
			const details = buildStoreFailureDetails(
				new Error(response.statusText),
				request,
				{
					status: response.status,
					statusText: response.statusText,
					body: responseBody,
				}
			);
			const failure: TouchedObjectStoreFailure = {
				ref,
				request,
				status: details.status,
				statusText: details.statusText,
				message: details.message,
				responseBody: details.responseBody,
				responseHeaders,
				isNetworkError: details.isNetworkError,
			};
			touchedObjectErrorRegistry.setFailure(failure);
			syncTouchedValidation(root, ref);
			return { ok: false, failure };
		}

		onStoreSuccess(root, ref);
		return { ok: true };
	} catch (error) {
		const details = buildStoreFailureDetails(error, request);
		const failure: TouchedObjectStoreFailure = {
			ref,
			request,
			status: details.status,
			statusText: details.statusText,
			message: details.message,
			responseBody: details.responseBody,
			isNetworkError: details.isNetworkError,
			cause: error,
		};
		touchedObjectErrorRegistry.setFailure(failure);
		syncTouchedValidation(root, ref);
		return { ok: false, failure };
	}
}

export async function storeSelectedTouchedObjects(
	root: IRootStore,
	refs: TouchedObjectRef[]
): Promise<StoreSelectedResult> {
	const sorted = sortForStore(refs);
	const failed: TouchedObjectStoreFailure[] = [];
	let saved = 0;

	for (const ref of sorted) {
		const result = await storeSingleRef(root, ref);
		if (result.ok) {
			saved++;
		} else if (result.failure) {
			failed.push(result.failure);
		}
	}

	return { saved, failed };
}

/** @deprecated use storeSelectedTouchedObjects */
export async function storeAllPendingChanges(root: IRootStore): Promise<{ failed: TouchedObjectRef[] }> {
	const refs = collectTouchedObjects(root);
	const { failed } = await storeSelectedTouchedObjects(root, refs);
	return { failed: failed.map((f) => f.ref) };
}
