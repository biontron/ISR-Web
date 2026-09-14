import authStore from "../Stores/Auth.Store";
import { IRootStore } from "../Stores/Root.Store";
import { buildRestUrl, RestUrlKind } from "./restUrlCatalog";
import { TouchedObjectRef } from "./touchedObjects";
import { restWritePayloadForRef } from "./restWritePayload";
import { knownEnvironmentIds, resolveWriteEnvironmentId } from "./viewEnvironments";

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
	const viewId = root.ui.activeView?.id ?? "";
	const itemId = ref.id;
	let env = "";
	if (ref.kind === "Asset") {
		const asset = root.assets.assets.find((item) => item.id === itemId);
		env = resolveWriteEnvironmentId(
			knownEnvironmentIds(root),
			root.ui.activeView,
			asset?.environmentId
		);
		if (asset && env) {
			asset.setEnvironmentId(env);
		}
	} else if (ref.kind === "Connection") {
		const connection = root.connections.connections.find((item) => item.id === itemId);
		env = resolveWriteEnvironmentId(
			knownEnvironmentIds(root),
			root.ui.activeView,
			connection?.environmentId
		);
		if (connection && env) {
			connection.setEnvironmentId(env);
		}
	} else {
		env = resolveWriteEnvironmentId(knownEnvironmentIds(root), root.ui.activeView);
	}

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
