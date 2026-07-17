import { ElementKindType, SchemaStoreType } from "./schemaDomain";

function defaultElementKindForStoreType(storeType: SchemaStoreType): ElementKindType {
	switch (storeType) {
		case "COMPONENT":
			return "COMPONENT";
		case "VIEWGROUP":
			return "GROUP";
		case "DOCKPART":
			return "CONNECTION";
		case "INTERNAL":
		default:
			return "TEMPLATE";
	}
}

export function createEmptySchemaPayload(
	schemaId: string,
	storeType: SchemaStoreType
): Record<string, unknown> {
	return {
		id: schemaId,
		storeType,
		baseType: defaultElementKindForStoreType(storeType),
		type: schemaId,
		subType: "",
		name: { intl: schemaId, de: schemaId, en: schemaId },
		description: { intl: "", de: "", en: "" },
		order: 0,
		parent: { whitelist: [], blacklist: [] },
		style: { treeIcon: "" },
		items: [],
	};
}
