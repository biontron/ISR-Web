import { IRootStore } from "../Stores/Root.Store";
import { ElementStatus, IElement } from "../Stores/Models/Element.Model";
import { IView } from "../Stores/Models/View.Model";
import { IGroup } from "../Stores/Models/Group.Model";
import { IAsset } from "../Stores/Models/Asset.Model";
import { getConnectionDisplayName, IConnection } from "../Stores/Models/Connection.Model";
import type { ISchemaModel } from "../Stores/Models/Schema.Model";
import type { IConnectSchemaModel } from "../Stores/Models/ConnectSchema.Model";
import type { IEnvironment } from "../Stores/Models/Environment.Model";
import { SchemaStoreType } from "./schemaDomain";
import { isTouchedStatus, touchKindFromStatus } from "./elementStaging";

export type TouchedObjectKind =
	| "View"
	| "Group"
	| "Asset"
	| "Connection"
	| "Environment"
	| "EditorSchema"
	| "DockpartSchema";

export interface TouchedObjectRef {
	id: string;
	kind: TouchedObjectKind;
	touch: "create" | "update" | "delete";
	name: string;
	status: ElementStatus;
	schemaStoreType?: SchemaStoreType;
	element: IView | IGroup | IAsset | IConnection | IEnvironment | ISchemaModel | IConnectSchemaModel;
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

	const environments = root.environments?.environments;
	if (environments) {
		for (const environment of environments) {
			if (environment.status !== "changed") {
				continue;
			}
			pending.push({
				id: environment.id,
				kind: "Environment",
				touch: "update",
				name: environment.definition?.name?.trim() || environment.id,
				status: "changed",
				element: environment,
			});
		}
	}

	const configSchemas = root.configSchemas;
	if (configSchemas) {
		for (const schema of configSchemas.internals) {
			pushNewSchema(pending, schema);
		}
		for (const schema of configSchemas.viewgroups) {
			pushNewSchema(pending, schema);
		}
		for (const schema of configSchemas.components) {
			pushNewSchema(pending, schema);
		}
		for (const schema of configSchemas.dockparts) {
			pushNewSchema(pending, schema);
		}
	}

	return pending;
}

function schemaLabel(schema: ISchemaModel | IConnectSchemaModel): string {
	const name: unknown = schema.name;
	if (name && typeof name === "object" && typeof (name as { get?: unknown }).get === "function") {
		const map = name as { get: (key: string) => string | undefined };
		return map.get("de") || map.get("und") || map.get("en") || map.get("intl") || schema.id;
	}
	if (name && typeof name === "object") {
		const record = name as Record<string, unknown>;
		for (const key of ["de", "und", "en", "intl"]) {
			const value = record[key];
			if (typeof value === "string" && value) {
				return value;
			}
		}
	}
	return schema.id;
}

/** Nur neu angelegte Schemata. Bestehende Bearbeitungen bleiben lokal. */
function pushNewSchema(
	pending: TouchedObjectRef[],
	schema: ISchemaModel | IConnectSchemaModel
): void {
	if (!isTouchedStatus(schema.status)) {
		return;
	}
	const touch = touchKindFromStatus(schema.status, schema.statusBeforeInvalid);
	if (touch !== "create") {
		return;
	}
	pending.push({
		id: schema.id,
		kind: schema.storeType === "DOCKPART" ? "DockpartSchema" : "EditorSchema",
		schemaStoreType: schema.storeType,
		touch,
		name: schemaLabel(schema),
		status: schema.status,
		element: schema,
	});
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
		case "EditorSchema":
		case "DockpartSchema":
			root.configSchemas.removeStagedSchema(ref.element as ISchemaModel | IConnectSchemaModel);
			break;
		case "Environment":
			break;
	}
}

export function undoTouchedObject(root: IRootStore, ref: TouchedObjectRef): void {
	if (ref.kind === "Environment") {
		(ref.element as IEnvironment).rollbackIgnoredDevices();
		return;
	}

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
