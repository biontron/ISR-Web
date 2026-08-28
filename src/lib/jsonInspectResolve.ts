import { getSnapshot } from "mobx-state-tree";
import { IRootStore } from "../Stores/Root.Store";
import { IElement } from "../Stores/Models/Element.Model";
import {
	getConnectionDisplayName,
	IConnection,
} from "../Stores/Models/Connection.Model";
import { SchemaBaseType } from "./schemaDomain";
import { rewriteFilterRulesInSnapshot } from "./filterRuleNormalize";

export interface JsonInspectTarget {
	title: string;
	kind: string;
	current: unknown;
	baseline?: unknown;
}

function inspectSnapshot(element: { class?: string }, snapshot: unknown): unknown {
	if (element.class === "Group" || element.class === "View") {
		return rewriteFilterRulesInSnapshot(snapshot);
	}
	return snapshot;
}

function elementBaseline(element: IElement): unknown | undefined {
	const snapshot = (element as { editSnapshot?: unknown }).editSnapshot;
	if (!snapshot) {
		return undefined;
	}
	const status = element.status;
	if (status !== "edit" && status !== "changed") {
		return undefined;
	}
	return inspectSnapshot(element, snapshot);
}

function resolveFromAssetManagement(root: IRootStore): JsonInspectTarget | null {
	const element = root.ui.activeElement;
	if (!element) {
		return null;
	}

	const current = inspectSnapshot(element, getSnapshot(element));
	const baseline = elementBaseline(element as IElement);
	const name =
		"definition" in element && element.definition && "name" in element.definition
			? String(element.definition.name)
			: element.id;

	return {
		title: `${element.class}: ${name}`,
		kind: element.class,
		current,
		baseline,
	};
}

function schemaInspectKind(baseType: SchemaBaseType): string {
	switch (baseType) {
		case "INTERNAL":
			return "InternalSchema";
		case "VIEWGROUP":
			return "ViewGroupSchema";
		case "COMPONENT":
			return "ComponentSchema";
		case "DOCKPART":
			return "DockpartSchema";
	}
}

function schemaKindLabel(baseType: SchemaBaseType): string {
	switch (baseType) {
		case "INTERNAL":
			return "InternalSchema";
		case "VIEWGROUP":
			return "ViewGroupSchema";
		case "COMPONENT":
			return "ComponentSchema";
		case "DOCKPART":
			return "DockpartSchema";
		default:
			return "Schema";
	}
}

function resolveFromSchemaManagement(root: IRootStore): JsonInspectTarget | null {
	const schemaId = root.ui.selectedConfigSchemaId;
	if (!schemaId) {
		return null;
	}
	const baseType = root.ui.selectedSchemaBaseType as SchemaBaseType;
	const schema = root.configSchemas.getSchema(baseType, schemaId);
	if (!schema) {
		return null;
	}
	return buildConfigSchemaJsonInspectTarget(schema as IElement, baseType);
}

export function buildConfigSchemaJsonInspectTarget(
	schema: IElement,
	baseType: SchemaBaseType
): JsonInspectTarget {
	return {
		title: `${schemaKindLabel(baseType)}: ${schema.id}`,
		kind: schemaInspectKind(baseType),
		current: getSnapshot(schema),
		baseline: elementBaseline(schema),
	};
}

export function buildConnectionJsonInspectTarget(connection: IConnection): JsonInspectTarget {
	return {
		title: getConnectionDisplayName(connection),
		kind: connection.class,
		current: getSnapshot(connection),
		baseline: elementBaseline(connection),
	};
}

/** Ermittelt das aktuell inspizierbare Objekt je nach Anwendung/Selektion. */
export function resolveJsonInspectTarget(root: IRootStore): JsonInspectTarget | null {
	const pathname = window.location.pathname;

	if (pathname.includes("/sm") || pathname.includes("/dsm")) {
		return resolveFromSchemaManagement(root);
	}
	if (pathname.includes("/am")) {
		return resolveFromAssetManagement(root);
	}

	return resolveFromAssetManagement(root);
}

export function hasJsonInspectTarget(root: IRootStore): boolean {
	return resolveJsonInspectTarget(root) !== null;
}
