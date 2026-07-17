import { ISchemaDefinition } from "../Interfaces/SchemaDefinition";
import { IConnectSchemaModel } from "../Stores/Models/ConnectSchema.Model";
import { IConnectSchemaItem } from "../Stores/Types/ConnectSchemaItem";
import { buildDefaultsFromSchemaItems } from "./schemaEntryDefaults";

/** Bekannte Schema/MST-Shape-Konflikte — nicht im Asset-Dockpart-Editor (basedOn: Map vs. Array). */
const DOCKPART_EDITOR_OMITTED_SCHEMA_KEYS = new Set(["basedOn"]);

function filterDockpartEditorSchemaItems(items: IConnectSchemaItem[]): IConnectSchemaItem[] {
	return items.filter(
		(item) => !DOCKPART_EDITOR_OMITTED_SCHEMA_KEYS.has(item.dataStructure.itemName)
	);
}

/**
 * Liefert die erlaubten darunterliegenden Stack-Typen (parent.whitelist).
 * Das ist eine Protokoll-Hierarchie (wie dependsOn / basedOn), keine Schema-Feld-Vererbung.
 */
export function getAllowedStackParentTypes(schema: IConnectSchemaModel): string[] {
	return schema.parent.whitelist.slice();
}

/**
 * Aufgelöstes Dockpart-Schema: nur die Felder dieses Schemas (kein Merge über parent).
 */
export function resolveDockpartSchemaDefinition(
	schema: IConnectSchemaModel | undefined,
	_allSchemas?: IConnectSchemaModel[]
): ISchemaDefinition | undefined {
	if (!schema) return undefined;

	return {
		id: schema.id,
		type: schema.type,
		items: [...schema.items].sort((a, b) => a.order - b.order) as IConnectSchemaItem[],
	};
}

export function resolveDockpartSchemaById(
	schemaId: string,
	allSchemas: IConnectSchemaModel[]
): ISchemaDefinition | undefined {
	const schema = allSchemas.find(
		(s) =>
			s.id === schemaId ||
			s.type === schemaId ||
			s.id.toLowerCase() === schemaId.toLowerCase()
	);
	return resolveDockpartSchemaDefinition(schema, allSchemas);
}

/** DOCKPART-Schema für eine Dockpart-Instanz anhand ihres `type`-Feldes */
export function resolveDockpartEntrySchemaDefinition(
	dockpart: unknown,
	allSchemas: IConnectSchemaModel[]
): ISchemaDefinition | undefined {
	if (dockpart == null || typeof dockpart !== "object") {
		return undefined;
	}

	const type = (dockpart as { type?: unknown }).type;
	if (type == null || type === "") {
		return undefined;
	}

	const resolved = resolveDockpartSchemaById(String(type), allSchemas);
	if (!resolved) {
		return undefined;
	}

	return {
		...resolved,
		items: filterDockpartEditorSchemaItems(resolved.items as IConnectSchemaItem[]),
	};
}

/** Baut Default-Werte für eine neue Dockpart-Instanz aus dem aufgelösten Schema */
export function buildDockpartDefaultsFromSchema(
	resolvedSchema: ISchemaDefinition
): Record<string, unknown> {
	const defaults = buildDefaultsFromSchemaItems(
		resolvedSchema.items as IConnectSchemaItem[] as any
	);
	delete defaults.id;
	return defaults;
}

/** Leere Instanz für ein einzelnes Dockpart-Element (Vorschau / neues Element) */
export function createEmptyDockpartInstance(
	schemaId: string,
	allSchemas: IConnectSchemaModel[] = []
): Record<string, unknown> {
	const schema = allSchemas.find(
		(s) =>
			s.id === schemaId ||
			s.type === schemaId ||
			s.id.toLowerCase() === schemaId.toLowerCase()
	);
	const resolved = resolveDockpartSchemaById(schemaId, allSchemas);
	const defaults = resolved ? buildDockpartDefaultsFromSchema(resolved) : {};

	return {
		id: "",
		type: schema?.type ?? schemaId,
		protocol: "",
		...defaults,
		versions: Array.isArray(defaults.versions) ? defaults.versions : [],
		basedOn: Array.isArray(defaults.basedOn) ? defaults.basedOn : [],
	};
}

/** Snapshot für eine neue Dockpart-Instanz — nur Dockpart-Root; Details via SchemaEditor-Defaults */
export function createNewDockpartSnapshot(
	schemaId: string,
	partId: string,
	allSchemas: IConnectSchemaModel[]
): Record<string, unknown> {
	const schema = allSchemas.find(
		(s) =>
			s.id === schemaId ||
			s.type === schemaId ||
			s.id.toLowerCase() === schemaId.toLowerCase()
	);

	return {
		id: partId,
		type: String(schema?.type ?? schemaId),
		label: String(schema?.type ?? schemaId),
		protocol: "",
		versions: [],
		basedOn: [],
		settings: {},
	};
}
