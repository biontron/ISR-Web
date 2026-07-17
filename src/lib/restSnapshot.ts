import { applySnapshot, getSnapshot, IAnyModelType, IStateTreeNode } from "mobx-state-tree";
import { RestRequestError } from "./api";
import { buildRestUrl, RestUrlIds, RestUrlKind } from "./restUrlCatalog";
import { SchemaBaseType } from "./schemaDomain";
import { restLoadErrorRegistry, RestLoadReport } from "../Stores/RestLoadErrorRegistry";

export type RestObjectKind =
	| "InternalSchema"
	| "ViewGroupSchema"
	| "ComponentSchema"
	| "ElementSchema"
	| "EditorSchema"
	| "DockpartSchema"
	| "IaCPackage"
	| "IaCTemplate"
	| "View"
	| "Group"
	| "Asset"
	| "Connection";

export type RestLoadErrorEntry = {
	objectKind: RestObjectKind;
	itemId: string;
	message: string;
	method?: "GET";
	path?: string;
	fullUrl?: string;
	httpStatus?: number;
	httpStatusText?: string;
	responseHeaders?: Record<string, string>;
	rawItem?: unknown;
	responseBody?: string;
};

export type RestLoadRequestMeta = {
	method: string;
	path: string;
	fullUrl: string;
	httpStatus?: number;
	httpStatusText?: string;
	responseHeaders?: Record<string, string>;
	responseBody?: string;
};

export type RestSnapshotResult = {
	snapshots: any[];
	errors: RestLoadErrorEntry[];
};

export type RestLoadOptions = {
	domain?: string;
	getItemId?: (item: unknown) => string;
	restUrlIds?: RestUrlIds;
};

const SCHEMA_KIND_STORE_TYPE: Partial<Record<RestObjectKind, SchemaBaseType>> = {
	InternalSchema: "INTERNAL",
	ViewGroupSchema: "VIEWGROUP",
	ComponentSchema: "COMPONENT",
	ElementSchema: "COMPONENT",
	EditorSchema: "COMPONENT",
	DockpartSchema: "DOCKPART",
};

const OBJECT_KIND_TO_URL_KIND: Partial<Record<RestObjectKind, RestUrlKind>> = {
	InternalSchema: "EditorSchema",
	ViewGroupSchema: "EditorSchema",
	ComponentSchema: "EditorSchema",
	ElementSchema: "EditorSchema",
	EditorSchema: "EditorSchema",
	DockpartSchema: "DockpartSchema",
	IaCPackage: "IaCPackage",
	IaCTemplate: "IaCTemplate",
	View: "View",
	Group: "Group",
	Asset: "Asset",
	Connection: "Connection",
};

export function buildRestLoadRequestMeta(
	objectKind: RestObjectKind,
	domain: string,
	restUrlIds: RestUrlIds = {}
): RestLoadRequestMeta {
	const urlKind = OBJECT_KIND_TO_URL_KIND[objectKind];
	if (!urlKind || !domain) {
		return { method: "GET", path: "", fullUrl: "" };
	}

	const schemaBaseType =
		restUrlIds.schemaBaseType ?? SCHEMA_KIND_STORE_TYPE[objectKind];

	const descriptor = buildRestUrl(domain, urlKind, "list", {
		...restUrlIds,
		...(schemaBaseType ? { schemaBaseType } : {}),
	});
	return {
		method: descriptor.method,
		path: descriptor.path,
		fullUrl: descriptor.fullUrl,
	};
}

function requestMetaFromError(error: unknown, fallback: RestLoadRequestMeta): RestLoadRequestMeta {
	if (error instanceof RestRequestError) {
		return {
			...fallback,
			path: error.path,
			httpStatus: error.status,
			httpStatusText: error.statusText,
			responseBody: error.responseBody,
			responseHeaders: error.responseHeaders,
		};
	}

	return fallback;
}

export function enrichRestLoadReport(
	report: RestLoadReport,
	objectKind: RestObjectKind,
	domain?: string,
	restUrlIds: RestUrlIds = {},
	httpStatus = 200
): RestLoadReport {
	if (!domain) {
		return report;
	}

	const baseRequest = buildRestLoadRequestMeta(objectKind, domain, restUrlIds);
	return {
		...report,
		request: {
			...baseRequest,
			...(report.request ?? {}),
			httpStatus: report.request?.httpStatus ?? httpStatus,
		},
	};
}

export type NormalizedRestArray = {
	items: unknown[];
	format: string;
};

export function defaultRestItemId(item: unknown): string {
	if (item && typeof item === "object") {
		const record = item as Record<string, unknown>;
		if (typeof record.id === "string") return record.id;
		if (typeof record.type === "string") return record.type;
	}
	return "unknown";
}

function formatLoadError(error: unknown): string {
	if (error instanceof Error) {
		return `MST-Validierung: ${error.message}`;
	}
	return `MST-Validierung: ${String(error)}`;
}

function isElementLike(value: unknown): boolean {
	return (
		value !== null &&
		typeof value === "object" &&
		typeof (value as { id?: unknown }).id === "string" &&
		typeof (value as { definition?: unknown }).definition === "object" &&
		(value as { definition?: unknown }).definition !== null
	);
}

function isSchemaLike(value: unknown): boolean {
	return (
		value !== null &&
		typeof value === "object" &&
		typeof (value as { id?: unknown }).id === "string" &&
		typeof (value as { type?: unknown }).type === "string"
	);
}

function isIacListItemLike(value: unknown): boolean {
	return (
		value !== null &&
		typeof value === "object" &&
		typeof (value as { name?: unknown }).name === "string" &&
		typeof (value as { uri?: unknown }).uri === "string"
	);
}

/**
 * Normalizes common REST response shapes into an array of items.
 */
export function normalizeRestArray(jsonData: unknown): NormalizedRestArray {
	if (Array.isArray(jsonData)) {
		return { items: jsonData, format: "array" };
	}

	if (jsonData && typeof jsonData === "object") {
		const record = jsonData as Record<string, unknown>;

		if (Array.isArray(record.data)) {
			return { items: record.data, format: "wrapper.data" };
		}

		if (Array.isArray(record.packages)) {
			return { items: record.packages, format: "wrapper.packages" };
		}

		if (Array.isArray(record.templates)) {
			return { items: record.templates, format: "wrapper.templates" };
		}

		if (isIacListItemLike(record)) {
			return { items: [jsonData], format: "single-iac-list-item" };
		}

		if (isElementLike(record)) {
			return { items: [jsonData], format: "single-element" };
		}

		// Ein einzelnes Element-Schema (hat selbst ein items-Array mit Felddefinitionen)
		if (isSchemaLike(record) && typeof record.type === "string") {
			return { items: [jsonData], format: "single-object" };
		}

		// Wrapper { items: [ schema, schema, ... ] } – nur wenn Kinder Schemas sind
		if (Array.isArray(record.items) && record.items.every(isSchemaLike)) {
			return { items: record.items, format: "wrapper.items" };
		}

		// Wrapper { items: [ asset|group|view, ... ] }
		if (Array.isArray(record.items) && record.items.length > 0 && record.items.every(isElementLike)) {
			return { items: record.items, format: "wrapper.items.elements" };
		}

		// Map keyed by schema id: { CONNECTION: {...}, LOCATION: {...} }
		const values = Object.values(record);
		if (values.length > 0 && values.every(isSchemaLike)) {
			return { items: values, format: "id-map" };
		}

		if (values.length > 0 && values.every(isElementLike)) {
			return { items: values, format: "element-id-map" };
		}

		if (values.length > 0 && values.every(isIacListItemLike)) {
			return { items: values, format: "iac-list-item-map" };
		}
	}

	return { items: [], format: "unknown" };
}

function collectRestIds(items: unknown[], getItemId: (item: unknown) => string): string[] {
	return items.map((item) => getItemId(item));
}

function collectStoreIds(
	arrayTarget: IStateTreeNode,
	getItemId: (item: unknown) => string = defaultRestItemId
): string[] {
	try {
		const snapshot = getSnapshot(arrayTarget) as unknown[];
		return snapshot.map((item) => getItemId(item));
	} catch {
		return [];
	}
}

function appendMissingRestItems(
	items: unknown[],
	snapshots: unknown[],
	errors: RestLoadErrorEntry[],
	objectKind: RestObjectKind,
	getItemId: (item: unknown) => string
): void {
	const loadedIds = new Set(snapshots.map((snapshot) => getItemId(snapshot)));
	for (const item of items) {
		const itemId = getItemId(item);
		if (!loadedIds.has(itemId) && !errors.some((error) => error.itemId === itemId)) {
			errors.push({
				objectKind,
				itemId,
				message: "Objekt war in der REST-Antwort enthalten, konnte aber nicht validiert werden (MobX create fehlgeschlagen).",
				rawItem: item,
			});
		}
	}
}

function appendMissingStoreItems(
	snapshots: unknown[],
	storeIds: string[],
	errors: RestLoadErrorEntry[],
	objectKind: RestObjectKind,
	getItemId: (item: unknown) => string
): void {
	for (const snapshot of snapshots) {
		const itemId = getItemId(snapshot);
		if (!storeIds.includes(itemId) && !errors.some((error) => error.itemId === itemId)) {
			errors.push({
				objectKind,
				itemId,
				message: "Objekt wurde validiert, fehlt aber nach applySnapshot im MobX-Store.",
			});
		}
	}
}

/**
 * Validates REST array items against an MST model.
 */
export function snapshotsFromRestArray(
	modelType: IAnyModelType,
	items: unknown[],
	objectKind: RestObjectKind,
	getItemId: (item: unknown) => string = defaultRestItemId
): RestSnapshotResult {
	const errors: RestLoadErrorEntry[] = [];
	const validSnapshots: any[] = [];

	for (const item of items) {
		const itemId = getItemId(item);
		try {
			validSnapshots.push(getSnapshot(modelType.create(item)));
		} catch (error) {
			const message = formatLoadError(error);
			errors.push({ objectKind, itemId, message, rawItem: item });
			console.error(
				`Ungültiges ${objectKind} '${itemId}' konnte nicht geladen werden:`,
				error,
				item
			);
		}
	}

	appendMissingRestItems(items, validSnapshots, errors, objectKind, getItemId);

	if (errors.length > 0) {
		console.error(
			`${objectKind}: ${errors.length} ungültige Element(e) übersprungen, ${validSnapshots.length} geladen.`
		);
	}

	return { snapshots: validSnapshots, errors };
}

function buildReport(
	objectKind: RestObjectKind,
	options: RestLoadOptions,
	responseFormat: string,
	restIds: string[],
	loadedIds: string[],
	errors: RestLoadErrorEntry[],
	request?: RestLoadRequestMeta
): RestLoadReport {
	return {
		objectKind,
		domain: options.domain,
		responseFormat,
		restCount: restIds.length,
		loadedCount: loadedIds.length,
		restIds,
		loadedIds,
		errors,
		loadedAt: new Date().toISOString(),
		request,
	};
}

/**
 * Validates REST data and applies valid snapshots to an MST array.
 * Caller must publish via publishRestLoadReport().
 */
export function loadRestArrayIntoStore(
	arrayTarget: IStateTreeNode,
	modelType: IAnyModelType,
	jsonData: unknown,
	objectKind: RestObjectKind,
	options: RestLoadOptions = {}
): RestLoadReport {
	const getItemId = options.getItemId ?? defaultRestItemId;
	const normalized = normalizeRestArray(jsonData);
	const { items, format } = normalized;
	const restIds = collectRestIds(items, getItemId);

	if (format === "unknown") {
		const errors: RestLoadErrorEntry[] = [{
			objectKind,
			itemId: "-",
			message: "REST-Antwort hat ein unbekanntes Format (Array erwartet).",
		}];
		console.error(`Ungültige REST-Antwort für ${objectKind}:`, jsonData);
		return buildReport(objectKind, options, format, restIds, collectStoreIds(arrayTarget, getItemId), errors);
	}

	const { snapshots, errors } = snapshotsFromRestArray(
		modelType,
		items,
		objectKind,
		getItemId
	);

	try {
		applySnapshot(arrayTarget, snapshots);
		const loadedIds = collectStoreIds(arrayTarget, getItemId);
		appendMissingStoreItems(snapshots, loadedIds, errors, objectKind, getItemId);
		return buildReport(objectKind, options, format, restIds, loadedIds, errors);
	} catch (error) {
		const applyError: RestLoadErrorEntry = {
			objectKind,
			itemId: "-",
			message: `applySnapshot fehlgeschlagen: ${formatLoadError(error)}`,
		};
		errors.push(applyError);
		console.error(`applySnapshot für ${objectKind} fehlgeschlagen:`, error);
		return buildReport(
			objectKind,
			options,
			format,
			restIds,
			collectStoreIds(arrayTarget, getItemId),
			errors
		);
	}
}

export function createRestLoadFailureReport(
	objectKind: RestObjectKind,
	error: unknown,
	options: RestLoadOptions = {}
): RestLoadReport {
	const domain = options.domain ?? "";
	const fallbackRequest = domain
		? buildRestLoadRequestMeta(objectKind, domain, options.restUrlIds ?? {})
		: { method: "GET", path: "", fullUrl: "" };
	const request = requestMetaFromError(error, fallbackRequest);

	const loadError: RestLoadErrorEntry = {
		objectKind,
		itemId: "-",
		message: formatLoadError(error),
		method: "GET",
		path: request.path,
		fullUrl: request.fullUrl,
		httpStatus: request.httpStatus,
		httpStatusText: request.httpStatusText,
		responseHeaders: request.responseHeaders,
		responseBody: request.responseBody,
	};
	console.error(`REST-Laden für ${objectKind} fehlgeschlagen:`, error);
	return buildReport(objectKind, options, "request-failed", [], [], [loadError], request);
}

export function publishRestLoadReport(report: RestLoadReport): void {
	restLoadErrorRegistry.setLoadResult(report.objectKind, report);
}
