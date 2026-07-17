/** REST-Schema-Sammlung: /config/schema/internals | viewgroups | components | dockparts */
export type SchemaStoreType = "INTERNAL" | "VIEWGROUP" | "COMPONENT" | "DOCKPART";

/** @deprecated Alias — meint storeType (URI-Sammlung), nicht definition.baseType */
export type SchemaBaseType = SchemaStoreType;

export const SCHEMA_STORE_TYPES: readonly SchemaStoreType[] = [
	"INTERNAL",
	"VIEWGROUP",
	"COMPONENT",
	"DOCKPART",
];

export const SCHEMA_BASE_TYPES = SCHEMA_STORE_TYPES;

/** Element-Art laut XSD (definition.baseType / schema.baseType) */
export type ElementKindType = "GROUP" | "COMPONENT" | "CONNECTION" | "TEMPLATE";

export const ELEMENT_KIND_TYPES: readonly ElementKindType[] = [
	"GROUP",
	"COMPONENT",
	"CONNECTION",
	"TEMPLATE",
];

/** Interne Schemata (z. B. ANY-*), die Benutzer nicht bearbeiten dürfen. */
export const SYSTEM_RESERVED_READ_ONLY_IDS = [
	"ANY-DEFINITION",
	"ANY-PROPERTIES",
	"COMPONENT-DOCKS",
	"CONNECTION",
] as const;

export function isSchemaStoreType(value: unknown): value is SchemaStoreType {
	return typeof value === "string" && (SCHEMA_STORE_TYPES as readonly string[]).includes(value);
}

/** @deprecated Nutze isSchemaStoreType */
export function isSchemaBaseType(value: unknown): value is SchemaBaseType {
	return isSchemaStoreType(value);
}

export function isElementKindType(value: unknown): value is ElementKindType {
	return typeof value === "string" && (ELEMENT_KIND_TYPES as readonly string[]).includes(value);
}

export function schemaStoreTypeFromPathSegment(segment: string): SchemaStoreType | undefined {
	switch (segment.toLowerCase()) {
		case "internals":
		case "internal":
		case "systems":
		case "system":
			return "INTERNAL";
		case "viewgroups":
		case "viewgroup":
		case "groups":
		case "group":
			return "VIEWGROUP";
		case "components":
		case "component":
		case "elements":
		case "element":
			return "COMPONENT";
		case "dockparts":
		case "dockpart":
		case "docparts":
		case "docpart":
		case "portpart":
			return "DOCKPART";
		default:
			return undefined;
	}
}

/** @deprecated Nutze schemaStoreTypeFromPathSegment */
export function schemaBaseTypeFromPathSegment(segment: string): SchemaBaseType | undefined {
	return schemaStoreTypeFromPathSegment(segment);
}
