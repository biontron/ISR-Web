import authStore from "../Stores/Auth.Store";
import { IRootStore } from "../Stores/Root.Store";
import { buildRestUrl, RestUrlKind } from "./restUrlCatalog";
import { TouchedObjectRef } from "./touchedObjects";
import { restWritePayloadForRef } from "./restWritePayload";

export interface TouchedObjectRestRequest {
	method: string;
	path: string;
	fullUrl: string;
	payload?: unknown;
}

function kindToRestUrlKind(kind: TouchedObjectRef["kind"]): RestUrlKind {
	return kind;
}

export function buildRestRequestForTouchedObject(
	root: IRootStore,
	ref: TouchedObjectRef
): TouchedObjectRestRequest {
	const domain = authStore.getDomain() ?? "";
	const env = root.config.environment;
	const viewId = root.ui.activeView?.id ?? "";
	const itemId = ref.id;

	let operation: "create" | "update" | "delete";
	switch (ref.touch) {
		case "create":
			operation = "create";
			break;
		case "update":
			operation = "update";
			break;
		case "delete":
			operation = "delete";
			break;
	}

	const url = buildRestUrl(domain, kindToRestUrlKind(ref.kind), operation, {
		itemId,
		viewId,
		env,
	});

	const request: TouchedObjectRestRequest = {
		method: url.method,
		path: url.path,
		fullUrl: url.fullUrl,
	};

	if (ref.touch !== "delete") {
		request.payload = restWritePayloadForRef(root, ref);
	}

	return request;
}
