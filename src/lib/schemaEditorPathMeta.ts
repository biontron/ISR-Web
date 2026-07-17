import { formatExtraValue } from "./schemaDeviation";
import { ISchemaFieldModel } from "../Stores/Models/SchemaField.Model";
import { ISchemaGroupModel } from "../Stores/Models/SchemaGroup.Model";

export function formatMstValuePreview(value: unknown, maxLength = 160): string {
	if (value === undefined) {
		return "∅";
	}
	const text = formatExtraValue(value).replace(/\s+/g, " ").trim();
	if (!text) {
		return "\"\"";
	}
	return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export function formatSchemaFieldTypeLabel(field: ISchemaFieldModel): string {
	const nullable = Boolean(field.dataStructure?.nullable || field.itemFlags?.nullable);
	return nullable ? `${field.fieldType} (nullable)` : field.fieldType;
}

export function formatSchemaGroupTypeLabel(group: ISchemaGroupModel): string {
	return `${group.collectionType} [${group.minUsage}..${group.maxUsage}]`;
}
