import {
	SCHEMA_BASE_TYPES,
	SchemaStoreType,
	SYSTEM_RESERVED_READ_ONLY_IDS,
} from "./schemaDomain";

export function isSchemaUserEditable(
	schema: { id: string; storeType: SchemaStoreType },
	isReadOnly: boolean
): boolean {
	if (isReadOnly) {
		return false;
	}
	if ((SYSTEM_RESERVED_READ_ONLY_IDS as readonly string[]).includes(schema.id)) {
		return false;
	}
	return schema.storeType === "COMPONENT" || schema.storeType === "DOCKPART" || schema.storeType === "VIEWGROUP";
}

export function isSchemaUserCreatable(
	storeType: SchemaStoreType,
	isReadOnly: boolean
): boolean {
	if (isReadOnly) {
		return false;
	}
	return storeType === "COMPONENT" || storeType === "DOCKPART" || storeType === "VIEWGROUP";
}
