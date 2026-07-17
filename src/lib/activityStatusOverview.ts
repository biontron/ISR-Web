import { restLoadErrorRegistry, RestLoadReport } from "../Stores/RestLoadErrorRegistry";
import { IRootStore } from "../Stores/Root.Store";
import authStore from "../Stores/Auth.Store";
import { RestLoadErrorEntry, RestObjectKind } from "./restSnapshot";
import { buildRestUrl, RestUrlKind } from "./restUrlCatalog";
import { buildRestRequestForTouchedObject } from "./restRequestForTouchedObject";
import { touchedObjectErrorRegistry } from "./touchedObjectErrors";
import { collectTouchedObjects, TouchedObjectRef } from "./touchedObjects";
import { iacWriteErrorRegistry } from "./iacWriteActivity";

export type ActivityKind = RestObjectKind | RestUrlKind;

export type ActivityStatus =
	| "read-interface"
	| "read-interface-error"
	| "read-error"
	| "create"
	| "update"
	| "delete"
	| "store-error";

export interface ActivityStatusRow {
	rowKey: string;
	activity: ActivityStatus;
	kind: ActivityKind;
	name: string;
	itemId: string;
	httpStatus?: number;
	httpStatusText?: string;
	isNetworkError?: boolean;
	errorMessage?: string;
	rest: {
		method: string;
		path: string;
		fullUrl: string;
		payload?: unknown;
		responseBody?: string;
		responseHeaders?: Record<string, string>;
	};
	touchedRef?: TouchedObjectRef;
	loadError?: RestLoadErrorEntry;
	loadReport?: RestLoadReport;
}

function rowFromLoadReport(report: RestLoadReport): ActivityStatusRow {
	const request = report.request;
	const objectErrors = report.errors.filter((error) => error.itemId !== "-");
	const requestFailed = report.responseFormat === "request-failed";
	const hasObjectErrors = objectErrors.length > 0;
	const hasErrors = requestFailed || hasObjectErrors;

	let errorMessage: string;
	if (requestFailed) {
		errorMessage =
			report.errors.find((error) => error.itemId === "-")?.message ??
			"Schnittstellen-Aufruf fehlgeschlagen";
	} else if (hasObjectErrors) {
		errorMessage = `${objectErrors.length} von ${report.restCount} Objekt(en) fehlerhaft · ${report.loadedCount} geladen`;
	} else {
		errorMessage = `${report.loadedCount} Element(e) geladen`;
	}

	return {
		rowKey: `read-interface:${report.objectKind}`,
		activity: hasErrors ? "read-interface-error" : "read-interface",
		kind: report.objectKind,
		name: request ? `${request.method} ${request.path}` : report.objectKind,
		itemId: "-",
		httpStatus: request?.httpStatus ?? (requestFailed ? undefined : 200),
		errorMessage,
		rest: {
			method: request?.method ?? "GET",
			path: request?.path ?? "",
			fullUrl: request?.fullUrl ?? "",
			payload: {
				restCount: report.restCount,
				loadedCount: report.loadedCount,
				responseFormat: report.responseFormat,
				errors: report.errors,
			},
			responseBody: request?.responseBody,
			responseHeaders: request?.responseHeaders,
		},
		loadReport: report,
	};
}

function rowFromLoadError(error: RestLoadErrorEntry): ActivityStatusRow {
	return {
		rowKey: `read-object:${error.objectKind}:${error.itemId}`,
		activity: "read-error",
		kind: error.objectKind,
		name: error.itemId,
		itemId: error.itemId,
		httpStatus: error.httpStatus,
		httpStatusText: error.httpStatusText,
		errorMessage: error.message,
		rest: {
			method: error.method ?? "GET",
			path: error.path ?? "",
			fullUrl: error.fullUrl ?? "",
			payload: error.rawItem ?? error.responseBody,
			responseBody: error.responseBody,
			responseHeaders: error.responseHeaders,
		},
		loadError: error,
	};
}

function rowFromTouched(root: IRootStore, ref: TouchedObjectRef): ActivityStatusRow {
	const request = buildRestRequestForTouchedObject(root, ref);
	const storeFailure = touchedObjectErrorRegistry.get(ref.id);

	if (storeFailure) {
		return {
			rowKey: `store-error:${ref.kind}:${ref.id}`,
			activity: "store-error",
			kind: ref.kind,
			name: ref.name,
			itemId: ref.id,
			httpStatus: storeFailure.status,
			httpStatusText: storeFailure.statusText,
			isNetworkError: storeFailure.isNetworkError,
			errorMessage: storeFailure.message,
			rest: {
				method: storeFailure.request.method,
				path: storeFailure.request.path,
				fullUrl: storeFailure.request.fullUrl,
				payload: storeFailure.request.payload,
				responseBody: storeFailure.responseBody,
				responseHeaders: storeFailure.responseHeaders,
			},
			touchedRef: ref,
		};
	}

	return {
		rowKey: `write:${ref.touch}:${ref.kind}:${ref.id}`,
		activity: ref.touch,
		kind: ref.kind,
		name: ref.name,
		itemId: ref.id,
		rest: {
			method: request.method,
			path: request.path,
			fullUrl: request.fullUrl,
			payload: request.payload,
		},
		touchedRef: ref,
	};
}

export function collectReadInterfaceRows(): ActivityStatusRow[] {
	return Object.values(restLoadErrorRegistry.reportsBySource)
		.filter((report): report is RestLoadReport => !!report)
		.map(rowFromLoadReport);
}

export function collectReadObjectErrorRows(): ActivityStatusRow[] {
	return restLoadErrorRegistry.allErrors
		.filter((error) => error.itemId !== "-")
		.map(rowFromLoadError);
}

/** REST-Schnittstellen + Objekt-Ladefehler (Tab „Read“) */
export function collectReadTabRows(_root: IRootStore): ActivityStatusRow[] {
	return [...collectReadInterfaceRows(), ...collectReadObjectErrorRows()];
}

export function collectWriteActivityRows(root: IRootStore): ActivityStatusRow[] {
	const touchedIds = new Set(collectTouchedObjects(root).map((ref) => ref.id));
	const rows: ActivityStatusRow[] = collectTouchedObjects(root).map((ref) =>
		rowFromTouched(root, ref)
	);

	for (const failure of touchedObjectErrorRegistry.all) {
		if (!touchedIds.has(failure.ref.id)) {
			rows.push(rowFromTouched(root, failure.ref));
		}
	}

	const iac = root.iac;
	if (iac.templateEditDirty && iac.selectedPackageName && iac.selectedTemplateName) {
		const request = buildRestUrl(
			authStore.getDomain() ?? "",
			"IaCTemplate",
			"update",
			{
				packageName: iac.selectedPackageName,
				templateName: iac.selectedTemplateName,
				itemId: iac.selectedTemplateName,
				templateVersion: iac.selectedTemplateVersion,
			}
		);
		rows.push({
			rowKey: `write:update:IaCTemplate:${iac.selectedPackageName}:${iac.selectedTemplateName}`,
			activity: "update",
			kind: "IaCTemplate",
			name: iac.selectedTemplateName,
			itemId: iac.selectedTemplateName,
			rest: {
				method: request.method,
				path: request.path,
				fullUrl: request.fullUrl,
				payload: iac.templateEditXml ?? undefined,
			},
		});
	}

	const iacFailure = iacWriteErrorRegistry.failure;
	if (iacFailure) {
		rows.push({
			rowKey: `store-error:IaCTemplate:${iacFailure.templateKey}`,
			activity: "store-error",
			kind: "IaCTemplate",
			name: iacFailure.templateName,
			itemId: iacFailure.templateName,
			httpStatus: iacFailure.status,
			httpStatusText: iacFailure.statusText,
			errorMessage: iacFailure.message,
			rest: {
				method: iacFailure.method,
				path: iacFailure.path,
				fullUrl: iacFailure.fullUrl,
				payload: iacFailure.payload,
				responseBody: iacFailure.responseBody,
				responseHeaders: iacFailure.responseHeaders,
			},
		});
	}

	return rows;
}

export function collectActivityStatusRows(root: IRootStore): ActivityStatusRow[] {
	return [...collectReadTabRows(root), ...collectWriteActivityRows(root)];
}

export function buildActivityStatusBadgeCount(root: IRootStore): {
	readErrors: number;
	touchedCount: number;
	storeErrors: number;
	total: number;
} {
	const readErrors =
		collectReadInterfaceRows().filter((row) => row.activity === "read-interface-error").length +
		collectReadObjectErrorRows().length;
	const touchedCount =
		collectTouchedObjects(root).length + (root.iac.templateEditDirty ? 1 : 0);
	const storeErrors = touchedObjectErrorRegistry.all.length + (iacWriteErrorRegistry.failure ? 1 : 0);

	return {
		readErrors,
		touchedCount,
		storeErrors,
		total: readErrors + touchedCount + storeErrors,
	};
}
