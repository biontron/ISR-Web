import { SchemaStoreType } from "./schemaDomain";

/** Pfad relativ zur API-Root: /api/{domain}/config/schema/... */
export const SCHEMA_REST_ROOT = "config/schema";

const SCHEMA_COLLECTION: Record<SchemaStoreType, string> = {
	INTERNAL: `${SCHEMA_REST_ROOT}/internals`,
	VIEWGROUP: `${SCHEMA_REST_ROOT}/viewgroups`,
	COMPONENT: `${SCHEMA_REST_ROOT}/components`,
	DOCKPART: `${SCHEMA_REST_ROOT}/dockparts`,
};

export function schemaListPath(storeType: SchemaStoreType): string {
	return SCHEMA_COLLECTION[storeType];
}

export function schemaListUri(domain: string, storeType: SchemaStoreType): string {
	return `/${domain}/${schemaListPath(storeType)}`;
}

export function schemaItemUri(domain: string, storeType: SchemaStoreType, schemaId: string): string {
	return `${schemaListUri(domain, storeType)}/${encodeURIComponent(schemaId)}`;
}
