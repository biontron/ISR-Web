import { ISchemaFieldModel } from "../Stores/Models/SchemaField.Model";
import { buildDockpartDataPath } from "./dockpartDataPath";
import { ELEMENT_DEFINITION_FIELD_PATH_ALIASES, isAssetDefinitionDataPath } from "./elementDefinitionTypes";
import { isSchemaDocumentElement } from "./schemaItemEditorMeta";

function isElementWithDefinition(
	elementData: unknown
): elementData is { class: string; definition: unknown } {
	return (
		typeof elementData === "object" &&
		elementData != null &&
		"class" in elementData &&
		"definition" in elementData
	);
}

/** Legacy-Namen im Meta-Schema SCHEMA → Eigenschaften am SchemaModel */
const SCHEMA_FIELD_PATH_ALIASES: Record<string, string> = {
	basetype: "baseType",
};

/** Felder im Meta-Schema SCHEMA ohne Entsprechung im SchemaModel */
const SCHEMA_OMITTED_FIELD_NAMES = new Set(["subtype"]);

export function resolveSchemaDocumentFieldPath(
	elementData: unknown,
	field: ISchemaFieldModel,
	pathPrefix: string
): string | null {
	const itemName = field.dataStructure.itemName;

	if (isSchemaDocumentElement(elementData) && SCHEMA_OMITTED_FIELD_NAMES.has(itemName)) {
		return null;
	}

	let segment = itemName;

	if (isSchemaDocumentElement(elementData) && SCHEMA_FIELD_PATH_ALIASES[itemName]) {
		segment = SCHEMA_FIELD_PATH_ALIASES[itemName];
	} else if (
		isElementWithDefinition(elementData) &&
		elementData.class === "Asset" &&
		isAssetDefinitionDataPath(pathPrefix) &&
		ELEMENT_DEFINITION_FIELD_PATH_ALIASES[itemName]
	) {
		segment = ELEMENT_DEFINITION_FIELD_PATH_ALIASES[itemName];
	}

	return buildDockpartDataPath(pathPrefix, segment);
}
