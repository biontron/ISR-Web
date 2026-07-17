import { ISchemaItem } from "../Stores/Types/SchemaItem";

const fieldFlags = { readonly: false, hidden: false, nullable: false };

/** Meta-Formular für einen SchemaField-Eintrag in schema.items[] */
// Plain snapshots — nicht als MST-Instanzen typisieren
export const SCHEMA_FIELD_ITEM_FORM_ITEMS = [
	{
		kind: "field",
		order: 1,
		dataStructure: { itemName: "order" },
		formProperties: { label: { und: "Order", de: "Reihenfolge" } },
		fieldType: "number",
		itemFlags: fieldFlags,
		minUsage: 1,
		maxUsage: 1,
	},
	{
		kind: "group",
		order: 2,
		dataStructure: { itemName: "dataStructure" },
		formProperties: { label: { und: "Data structure", de: "Datenstruktur" } },
		itemFlags: { readonly: false, hidden: false },
		minUsage: 1,
		maxUsage: 1,
		collectionType: "map",
		items: [
			{
				kind: "field",
				order: 1,
				dataStructure: { itemName: "itemName", default: "" },
				formProperties: { label: { und: "Item name", de: "Eigenschaftsname" } },
				fieldType: "string",
				itemFlags: fieldFlags,
				minUsage: 1,
				maxUsage: 1,
			},
			{
				kind: "field",
				order: 2,
				dataStructure: { itemName: "default", default: "" },
				formProperties: { label: { und: "Default", de: "Standardwert" } },
				fieldType: "string",
				itemFlags: { ...fieldFlags, nullable: true },
				minUsage: 0,
				maxUsage: 1,
			},
			{
				kind: "field",
				order: 3,
				dataStructure: { itemName: "nullable", default: "false" },
				formProperties: { label: { und: "Nullable", de: "Nullable" } },
				fieldType: "boolean",
				itemFlags: fieldFlags,
				minUsage: 0,
				maxUsage: 1,
			},
		],
	},
	{
		kind: "group",
		order: 3,
		dataStructure: { itemName: "formProperties" },
		formProperties: { label: { und: "Form properties", de: "Formular" } },
		itemFlags: { readonly: false, hidden: false },
		minUsage: 1,
		maxUsage: 1,
		collectionType: "map",
		items: [
			{
				kind: "field",
				order: 1,
				dataStructure: { itemName: "label", default: "" },
				formProperties: { label: { und: "Label", de: "Beschriftung" } },
				fieldType: "string",
				itemFlags: fieldFlags,
				minUsage: 1,
				maxUsage: 1,
			},
		],
	},
	{
		kind: "field",
		order: 4,
		dataStructure: { itemName: "fieldType", default: "string" },
		formProperties: { label: { und: "Field type", de: "Feldtyp" } },
		fieldType: "string",
		itemFlags: fieldFlags,
		minUsage: 1,
		maxUsage: 1,
	},
	{
		kind: "field",
		order: 5,
		dataStructure: { itemName: "rules", default: "" },
		formProperties: { label: { und: "Rules", de: "Regeln" } },
		fieldType: "string",
		itemFlags: { ...fieldFlags, nullable: true },
		minUsage: 0,
		maxUsage: 1,
	},
	{
		kind: "field",
		order: 6,
		dataStructure: { itemName: "example", default: "" },
		formProperties: { label: { und: "Example", de: "Beispiel" } },
		fieldType: "string",
		itemFlags: { ...fieldFlags, nullable: true },
		minUsage: 0,
		maxUsage: 1,
	},
	{
		kind: "group",
		order: 7,
		dataStructure: { itemName: "itemFlags" },
		formProperties: { label: { und: "Flags", de: "Flags" } },
		itemFlags: { readonly: false, hidden: false },
		minUsage: 1,
		maxUsage: 1,
		collectionType: "map",
		items: [
			{
				kind: "field",
				order: 1,
				dataStructure: { itemName: "readonly", default: "false" },
				formProperties: { label: { und: "Readonly", de: "Readonly" } },
				fieldType: "boolean",
				itemFlags: fieldFlags,
				minUsage: 0,
				maxUsage: 1,
			},
			{
				kind: "field",
				order: 2,
				dataStructure: { itemName: "hidden", default: "false" },
				formProperties: { label: { und: "Hidden", de: "Hidden" } },
				fieldType: "boolean",
				itemFlags: fieldFlags,
				minUsage: 0,
				maxUsage: 1,
			},
			{
				kind: "field",
				order: 3,
				dataStructure: { itemName: "nullable", default: "false" },
				formProperties: { label: { und: "Nullable", de: "Nullable" } },
				fieldType: "boolean",
				itemFlags: fieldFlags,
				minUsage: 0,
				maxUsage: 1,
			},
		],
	},
	{
		kind: "field",
		order: 8,
		dataStructure: { itemName: "minUsage", default: "0" },
		formProperties: { label: { und: "Min usage", de: "Min. Verwendung" } },
		fieldType: "number",
		itemFlags: fieldFlags,
		minUsage: 1,
		maxUsage: 1,
	},
	{
		kind: "field",
		order: 9,
		dataStructure: { itemName: "maxUsage", default: "1" },
		formProperties: { label: { und: "Max usage", de: "Max. Verwendung" } },
		fieldType: "number",
		itemFlags: fieldFlags,
		minUsage: 1,
		maxUsage: 1,
	},
];

/** Meta-Formular für einen SchemaGroup-Eintrag in schema.items[] */
export const SCHEMA_GROUP_ITEM_FORM_ITEMS = [
	{
		kind: "field",
		order: 1,
		dataStructure: { itemName: "order" },
		formProperties: { label: { und: "Order", de: "Reihenfolge" } },
		fieldType: "number",
		itemFlags: fieldFlags,
		minUsage: 1,
		maxUsage: 1,
	},
	{
		kind: "group",
		order: 2,
		dataStructure: { itemName: "dataStructure" },
		formProperties: { label: { und: "Data structure", de: "Datenstruktur" } },
		itemFlags: { readonly: false, hidden: false },
		minUsage: 1,
		maxUsage: 1,
		collectionType: "map",
		items: [
			{
				kind: "field",
				order: 1,
				dataStructure: { itemName: "itemName", default: "" },
				formProperties: { label: { und: "Item name", de: "Eigenschaftsname" } },
				fieldType: "string",
				itemFlags: fieldFlags,
				minUsage: 1,
				maxUsage: 1,
			},
		],
	},
	{
		kind: "group",
		order: 3,
		dataStructure: { itemName: "formProperties" },
		formProperties: { label: { und: "Form properties", de: "Formular" } },
		itemFlags: { readonly: false, hidden: false },
		minUsage: 1,
		maxUsage: 1,
		collectionType: "map",
		items: [
			{
				kind: "field",
				order: 1,
				dataStructure: { itemName: "label", default: "" },
				formProperties: { label: { und: "Label", de: "Beschriftung" } },
				fieldType: "string",
				itemFlags: fieldFlags,
				minUsage: 1,
				maxUsage: 1,
			},
		],
	},
	{
		kind: "group",
		order: 4,
		dataStructure: { itemName: "itemFlags" },
		formProperties: { label: { und: "Flags", de: "Flags" } },
		itemFlags: { readonly: false, hidden: false },
		minUsage: 0,
		maxUsage: 1,
		collectionType: "map",
		items: [
			{
				kind: "field",
				order: 1,
				dataStructure: { itemName: "readonly", default: "false" },
				formProperties: { label: { und: "Readonly", de: "Readonly" } },
				fieldType: "boolean",
				itemFlags: fieldFlags,
				minUsage: 0,
				maxUsage: 1,
			},
			{
				kind: "field",
				order: 2,
				dataStructure: { itemName: "hidden", default: "false" },
				formProperties: { label: { und: "Hidden", de: "Hidden" } },
				fieldType: "boolean",
				itemFlags: fieldFlags,
				minUsage: 0,
				maxUsage: 1,
			},
		],
	},
	{
		kind: "field",
		order: 5,
		dataStructure: { itemName: "minUsage", default: "0" },
		formProperties: { label: { und: "Min usage", de: "Min. Verwendung" } },
		fieldType: "number",
		itemFlags: fieldFlags,
		minUsage: 1,
		maxUsage: 1,
	},
	{
		kind: "field",
		order: 6,
		dataStructure: { itemName: "maxUsage", default: "1" },
		formProperties: { label: { und: "Max usage", de: "Max. Verwendung" } },
		fieldType: "number",
		itemFlags: fieldFlags,
		minUsage: 1,
		maxUsage: 1,
	},
	{
		kind: "field",
		order: 7,
		dataStructure: { itemName: "collectionType", default: "map" },
		formProperties: { label: { und: "Collection type", de: "Sammlungstyp" } },
		fieldType: "string",
		itemFlags: fieldFlags,
		minUsage: 1,
		maxUsage: 1,
	},
	{
		kind: "group",
		order: 8,
		dataStructure: { itemName: "items" },
		formProperties: { label: { und: "Items", de: "Felder und Gruppen" } },
		itemFlags: { readonly: false, hidden: false },
		minUsage: 0,
		maxUsage: 1,
		collectionType: "map",
		items: [],
	},
];

export function isSchemaDocumentElement(data: unknown): data is { baseType: string; items: unknown } {
	return (
		data != null &&
		typeof data === "object" &&
		"baseType" in data &&
		"items" in data
	);
}

export function isSchemaDefinitionItemsList(
	elementData: unknown,
	groupItemName: string,
	elementDataFragment: unknown
): boolean {
	return (
		isSchemaDocumentElement(elementData) &&
		groupItemName === "items" &&
		Array.isArray(elementDataFragment)
	);
}

export function resolveSchemaItemEntryFormItems(kind: unknown): ISchemaItem[] {
	return (kind === "group"
		? SCHEMA_GROUP_ITEM_FORM_ITEMS
		: SCHEMA_FIELD_ITEM_FORM_ITEMS) as unknown as ISchemaItem[];
}

export function createDefaultSchemaFieldItem(order: number): Record<string, unknown> {
	return {
		kind: "field",
		order,
		dataStructure: { itemName: "newField", default: "", nullable: false },
		formProperties: { label: { und: "New field", de: "Neues Feld" } },
		fieldType: "string",
		rules: "",
		example: "",
		itemFlags: { readonly: false, hidden: false, nullable: false },
		minUsage: 0,
		maxUsage: 1,
	};
}

export function createDefaultSchemaGroupItem(order: number): Record<string, unknown> {
	return {
		kind: "group",
		order,
		dataStructure: { itemName: "newGroup" },
		formProperties: { label: { und: "New group", de: "Neue Gruppe" } },
		itemFlags: { readonly: false, hidden: false },
		minUsage: 0,
		maxUsage: 1,
		collectionType: "map",
		items: [],
	};
}
