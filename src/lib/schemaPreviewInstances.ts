import { ISchemaDefinition } from "../Interfaces/SchemaDefinition";
import { ISchemaModel } from "../Stores/Models/Schema.Model";
import { IConnectSchemaModel } from "../Stores/Models/ConnectSchema.Model";
import { IConnectSchemaItem } from "../Stores/Types/ConnectSchemaItem";
import { ISchemaItem } from "../Stores/Types/SchemaItem";
import {
	buildDefaultsFromSchemaDefinition,
	buildDefaultsFromSchemaItems,
} from "./schemaEntryDefaults";

export function resolveLiveEditorSchemaDefinition(schema: ISchemaModel): ISchemaDefinition {
	return {
		id: schema.id,
		type: schema.type,
		items: [...schema.items].sort((a, b) => a.order - b.order) as ISchemaItem[],
	};
}

export function resolveLiveDockpartSchemaDefinition(
	schema: IConnectSchemaModel
): ISchemaDefinition {
	return {
		id: schema.id,
		type: schema.type,
		items: [...schema.items].sort((a, b) => a.order - b.order) as IConnectSchemaItem[],
	};
}

export function editorSchemaPreviewPathPrefix(schema: ISchemaModel): string {
	if (schema.id === "SCHEMA" || schema.type === "SCHEMA") {
		return "";
	}
	return "settings";
}

export function createEditorSchemaPreviewInstance(schema: ISchemaModel): Record<string, unknown> {
	const resolved = resolveLiveEditorSchemaDefinition(schema);
	const defaults = buildDefaultsFromSchemaDefinition(resolved);
	const pathPrefix = editorSchemaPreviewPathPrefix(schema);

	if (pathPrefix === "") {
		return {
			id: "preview",
			type: schema.type,
			...defaults,
		};
	}

	return {
		id: "preview",
		definition: {
			storeType: schema.storeType,
			baseType: schema.baseType,
			type: schema.type,
			subType: schema.subType ?? "",
			name: "Preview",
			label: "",
			description: "",
		},
		settings: defaults,
		properties: {
			responsibles: [],
			notations: [],
			style: { bgColor: "" },
		},
	};
}

export function createDockpartSchemaPreviewInstance(
	schema: IConnectSchemaModel
): Record<string, unknown> {
	const resolved = resolveLiveDockpartSchemaDefinition(schema);
	const defaults = buildDefaultsFromSchemaItems(resolved.items as IConnectSchemaItem[] as any);
	delete defaults.id;

	return {
		id: "",
		type: schema.type,
		protocol: "",
		...defaults,
		versions: Array.isArray(defaults.versions) ? defaults.versions : [],
		basedOn: Array.isArray(defaults.basedOn) ? defaults.basedOn : [],
	};
}
