import { ISchemaFieldModel } from "../Stores/Models/SchemaField.Model";
import { ISchemaGroupModel } from "../Stores/Models/SchemaGroup.Model";
import { ISchemaItem } from "../Stores/Types/SchemaItem";
import { ISchemaDefinition } from "../Interfaces/SchemaDefinition";
import { getFieldDefaultValue, isSchemaField, isSchemaGroup, isArrayCollectionGroup } from "./schemaDeviation";
import { resolveFieldValueOnAdd, SchemaAddFieldContext } from "./schemaAddFieldDefaults";

function defaultForFieldType(field: ISchemaFieldModel): unknown {
	switch (field.fieldType) {
		case "number":
			return 0;
		case "boolean":
			return false;
		case "array":
			return [];
		case "object":
			return {};
		default:
			return "";
	}
}

function defaultForField(field: ISchemaFieldModel): unknown | undefined {
	const fromSchema = getFieldDefaultValue(field);
	if (fromSchema !== undefined) {
		return fromSchema;
	}
	if (field.minUsage >= 1) {
		return defaultForFieldType(field);
	}
	return undefined;
}

export function getSchemaFieldInitialValue(field: ISchemaFieldModel): unknown | undefined {
	return defaultForField(field);
}

/** Initialwert für eine Schema-Gruppe (Array/Map/Objekt) inkl. minUsage-Pflichten */
export function buildMandatoryGroupValue(group: ISchemaGroupModel): unknown {
	if (group.minUsage <= 0) {
		return undefined;
	}

	if (isArrayCollectionGroup(group)) {
		const buildEntry = () => buildDefaultEntryFromSchemaItems(group.items);
		return Array.from({ length: group.minUsage }, buildEntry);
	}

	if (group.collectionType === "map") {
		if (group.dataStructure.itemName === "items" && group.items.length === 0) {
			return [];
		}
		return buildDefaultEntryFromSchemaItems(group.items);
	}

	return buildDefaultEntryFromSchemaItems(group.items);
}

/** Default-Objekt für einen neuen Array-Eintrag (ein Klick auf „+“) */
export function buildDefaultEntryFromSchemaItems(
	schemaItems: ISchemaItem[],
	addContext?: SchemaAddFieldContext
): Record<string, unknown> {
	const entry: Record<string, unknown> = {};

	for (const item of schemaItems) {
		if (isSchemaField(item)) {
			const name = item.dataStructure.itemName;
			const fromAdd =
				addContext &&
				resolveFieldValueOnAdd(item, {
					...addContext,
					dataPathPrefix: addContext.dataPathPrefix
						? `${addContext.dataPathPrefix}.${name}`
						: name,
				});
			const value = fromAdd !== undefined ? fromAdd : defaultForField(item);
			if (value !== undefined) {
				entry[name] = value;
			}
		} else if (isSchemaGroup(item)) {
			let nested: unknown;
			if (addContext && isArrayCollectionGroup(item) && item.minUsage <= 0) {
				nested = [];
			} else if (addContext) {
				const nestedPath = addContext.dataPathPrefix
					? `${addContext.dataPathPrefix}.${item.dataStructure.itemName}`
					: item.dataStructure.itemName;
				nested = buildDefaultEntryFromSchemaItems(item.items as any, {
					...addContext,
					dataPathPrefix: nestedPath,
					siblingArrayPath: isArrayCollectionGroup(item) ? nestedPath : addContext.siblingArrayPath,
				});
				if (
					isArrayCollectionGroup(item) &&
					item.minUsage <= 0 &&
					(!Array.isArray(nested) || nested.length === 0)
				) {
					nested = [];
				}
			} else {
				nested = buildMandatoryGroupValue(item);
			}
			if (nested !== undefined) {
				entry[item.dataStructure.itemName] = nested;
			}
		}
	}

	return entry;
}

/** Vollständige Default-Instanz für alle Schema-Items (Felder + Pflicht-Gruppen) */
export function buildDefaultsFromSchemaItems(schemaItems: ISchemaItem[]): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const item of schemaItems) {
		if (isSchemaField(item)) {
			const name = item.dataStructure.itemName;
			const value = defaultForField(item);
			if (value !== undefined) {
				result[name] = value;
			}
		} else if (isSchemaGroup(item)) {
			const value = buildMandatoryGroupValue(item);
			if (value !== undefined) {
				result[item.dataStructure.itemName] = value;
			}
		}
	}

	return result;
}

export function buildDefaultsFromSchemaDefinition(schema: ISchemaDefinition): Record<string, unknown> {
	return buildDefaultsFromSchemaItems(schema.items as ISchemaItem[]);
}
