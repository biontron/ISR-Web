import { getValueByPath } from "./path";
import { formatSchemaFieldDisplayValue } from "./common";
import { ISchemaFieldModel } from "../Stores/Models/SchemaField.Model";
import { ISchemaGroupModel } from "../Stores/Models/SchemaGroup.Model";
import { ISchemaItem } from "../Stores/Types/SchemaItem";
import { isSchemaDefinitionItemsList, isSchemaDocumentElement } from "./schemaItemEditorMeta";
import { buildDockpartDataPath, isDockpartRootDataPath } from "./dockpartDataPath";
import { isDockpartCoreKey } from "../Stores/Models/Dock.Model";

export interface ExtraDataEntry {
	path: string;
	value: unknown;
}

export interface StructuralMissingEntry {
	path: string;
	kind: "field" | "group";
}

export function isSchemaField(item: ISchemaItem): item is ISchemaFieldModel {
	return item.kind === "field";
}

export function isSchemaGroup(item: ISchemaItem): item is ISchemaGroupModel {
	return item.kind === "group";
}

export function isVariableGroup(group: ISchemaGroupModel): boolean {
	return group.minUsage !== group.maxUsage;
}

/** Festes Objekt (map mit minUsage=maxUsage=1) – Keys sind Feldnamen, keine dynamische Map */
export function isFixedObjectGroup(group: ISchemaGroupModel): boolean {
	return group.collectionType === "map" && group.minUsage === 1 && group.maxUsage === 1;
}

/** Map mit genau einem Objekt (maxUsage=1) — feste Objektstruktur, keine dynamische Key-Map */
export function isSingleMapObjectGroup(group: ISchemaGroupModel): boolean {
	return group.collectionType === "map" && group.maxUsage === 1;
}

export function isArrayCollectionGroup(group: ISchemaGroupModel): boolean {
	return group.collectionType === "array";
}

/** Datenpfad zu einer Schema-Gruppe (ANY-PROPERTIES/ANY-DEFINITION-Wrapper berücksichtigen). */
export function buildSchemaDataPath(
	pathPrefix: string,
	group: ISchemaGroupModel
): string {
	const itemName = group.dataStructure.itemName;
	if (!itemName) {
		return pathPrefix;
	}
	if (!pathPrefix) {
		return itemName;
	}

	if (
		isFixedObjectGroup(group) &&
		(pathPrefix === itemName || pathPrefix.endsWith(`.${itemName}`))
	) {
		return pathPrefix;
	}

	// Festes Objekt in einem Dock-Array-Eintrag: Daten liegen direkt unter docks[n], nicht unter docks[n].wrapper
	if (isFixedObjectGroup(group) && /^docks\[\d+\]$/.test(pathPrefix)) {
		return pathPrefix;
	}

	return buildDockpartDataPath(pathPrefix, itemName);
}

/**
 * Einstiegspunkte im Eigenschaften-Dialog:
 * - ANY-DEFINITION  → element.definition.*
 * - ANY-PROPERTIES  → element.properties.*
 * - COMPONENT-DOCKS → element.docks.*
 * - CONNECTION      → element.links.*
 * - baseType-Schema → element.settings.*
 *
 * Wrapper-Gruppen (feste map-Objekte „definition“ / „properties“) werden aufgelöst,
 * damit nur der jeweilige Datenbereich geprüft wird.
 */
export function resolveSchemaValidationScope(
	schemaItems: ISchemaItem[],
	pathPrefix: string
): { pathPrefix: string; schemaItems: ISchemaItem[] } {
	if (
		schemaItems.length === 1 &&
		isSchemaGroup(schemaItems[0]) &&
		isFixedObjectGroup(schemaItems[0])
	) {
		const wrapper = schemaItems[0];
		const wrapperName = wrapper.dataStructure.itemName;

		if (pathPrefix === "" || pathPrefix === wrapperName) {
			return {
				pathPrefix: pathPrefix === "" ? wrapperName : pathPrefix,
				schemaItems: wrapper.items,
			};
		}
	}

	return { pathPrefix, schemaItems };
}

function traverseGroupChildren(
	dataRoot: unknown,
	group: ISchemaGroupModel,
	itemPath: string,
	value: unknown,
	visit: (schemaItems: ISchemaItem[], childPath: string) => void
): void {
	if (!shouldValidateGroupContents(group, value)) {
		return;
	}

	if (isArrayCollectionGroup(group) && Array.isArray(value)) {
		value.forEach((_, index) => {
			visit(group.items, `${itemPath}[${index}]`);
		});
		return;
	}

	if (isFixedObjectGroup(group)) {
		visit(group.items, itemPath);
		return;
	}

	if (group.collectionType === "map") {
		for (const [mapKey] of getDataEntries(value)) {
			visit(group.items, joinPath(itemPath, mapKey));
		}
		return;
	}

	visit(group.items, itemPath);
}

/** Optionale Gruppe – noch keine Instanz angelegt (+), daher keine Kind-Validierung */
export function isOptionalGroupWithoutInstances(
	group: ISchemaGroupModel,
	value: unknown
): boolean {
	return group.minUsage === 0 && getGroupUsageCount(group, value) === 0;
}

export function shouldValidateGroupContents(
	group: ISchemaGroupModel,
	value: unknown
): boolean {
	return !isOptionalGroupWithoutInstances(group, value);
}

/** Interne MST-Felder — keine REST-Daten, nicht als Extra-Daten melden. */
const MST_INTERNAL_DATA_KEYS = new Set(["schemaExtensions"]);

function getDataEntries(data: unknown): [string, unknown][] {
	if (data == null || typeof data !== "object") {
		return [];
	}

	if (Array.isArray(data)) {
		return data.map((value, index) => [String(index), value]);
	}

	if (typeof (data as { entries?: unknown }).entries === "function") {
		return Array.from((data as Map<string, unknown>).entries());
	}

	if (typeof (data as { get?: unknown }).get === "function" && typeof (data as { keys?: unknown }).keys === "function") {
		const mapLike = data as { keys: () => Iterable<string>; get: (key: string) => unknown };
		return Array.from(mapLike.keys()).map((key) => [key, mapLike.get(key)]);
	}

	return Object.entries(data as Record<string, unknown>);
}

function joinPath(pathPrefix: string, segment: string): string {
	if (!pathPrefix) {
		return segment;
	}
	if (/^\d+$/.test(segment)) {
		return `${pathPrefix}[${segment}]`;
	}
	return buildDockpartDataPath(pathPrefix, segment);
}

function findExtraPathsInDockpartScope(
	dataRoot: unknown,
	schemaItems: ISchemaItem[],
	pathPrefix: string
): ExtraDataEntry[] {
	const data = getValueByPath(dataRoot, pathPrefix);
	const extras: ExtraDataEntry[] = [];

	if (data != null && typeof data === "object") {
		const schemaKeySet = new Set(schemaItems.map((item) => item.dataStructure.itemName));
		for (const [key, value] of getDataEntries(data)) {
			if (MST_INTERNAL_DATA_KEYS.has(key)) {
				continue;
			}
			if (isDockpartCoreKey(key)) {
				continue;
			}
			if (schemaKeySet.has(key)) {
				continue;
			}
			extras.push({
				path: joinPath(pathPrefix, key),
				value,
			});
		}
	}

	const hasExplicitSettingsGroup = schemaItems.some(
		(item) => isSchemaGroup(item) && item.dataStructure.itemName === "settings"
	);

	if (hasExplicitSettingsGroup) {
		extras.push(...findExtraPathsInScopePlain(dataRoot, schemaItems, pathPrefix));
		return extras;
	}

	const coreItems = schemaItems.filter((item) =>
		isDockpartCoreKey(item.dataStructure.itemName)
	);
	const settingsItems = schemaItems.filter(
		(item) => !isDockpartCoreKey(item.dataStructure.itemName)
	);

	if (coreItems.length > 0) {
		extras.push(...findExtraPathsInScopePlain(dataRoot, coreItems, pathPrefix));
	}

	if (settingsItems.length > 0) {
		extras.push(
			...findExtraPathsInScopePlain(dataRoot, settingsItems, `${pathPrefix}.settings`)
		);
	}

	return extras;
}

function findExtraPathsInScopePlain(
	dataRoot: unknown,
	schemaItems: ISchemaItem[],
	pathPrefix: string
): ExtraDataEntry[] {
	const data = pathPrefix ? getValueByPath(dataRoot, pathPrefix) : dataRoot;

	if (data == null || typeof data !== "object") {
		return [];
	}

	const extras: ExtraDataEntry[] = [];
	const schemaByName = new Map(
		schemaItems.map((item) => [item.dataStructure.itemName, item])
	);

	for (const [key, value] of getDataEntries(data)) {
		if (MST_INTERNAL_DATA_KEYS.has(key)) {
			continue;
		}

		const schemaItem = schemaByName.get(key);

		if (!schemaItem) {
			extras.push({
				path: joinPath(pathPrefix, key),
				value,
			});
			continue;
		}

		if (!isSchemaGroup(schemaItem)) {
			continue;
		}

		const childPath = joinPath(pathPrefix, key);

		if (isArrayCollectionGroup(schemaItem) && Array.isArray(value)) {
			value.forEach((item, index) => {
				if (index >= schemaItem.maxUsage) {
					extras.push({
						path: `${childPath}[${index}]`,
						value: item,
					});
					return;
				}

				extras.push(
					...findExtraPathsInScope(dataRoot, schemaItem.items, `${childPath}[${index}]`)
				);
			});
			continue;
		}

		traverseGroupChildren(dataRoot, schemaItem, childPath, value, (childItems, nestedPath) => {
			extras.push(...findExtraPathsInScope(dataRoot, childItems, nestedPath));
		});
	}

	return extras;
}

/** B – Daten vorhanden, laut Schema nicht zulässig */
export function findExtraPathsInScope(
	dataRoot: unknown,
	schemaItems: ISchemaItem[],
	pathPrefix: string
): ExtraDataEntry[] {
	if (isDockpartRootDataPath(pathPrefix)) {
		return findExtraPathsInDockpartScope(dataRoot, schemaItems, pathPrefix);
	}

	return findExtraPathsInScopePlain(dataRoot, schemaItems, pathPrefix);
}

function isFieldNullable(field: ISchemaFieldModel): boolean {
	return Boolean(field.dataStructure?.nullable || field.itemFlags?.nullable);
}

function isEmptyFieldValue(value: unknown, field: ISchemaFieldModel): boolean {
	if (value === undefined) {
		return false;
	}
	if (value === null) {
		return !isFieldNullable(field);
	}
	if (typeof value === "string") {
		if (value.trim() === "") {
			return !isFieldNullable(field);
		}
		return false;
	}
	return false;
}

/** Live-Validierung im Editor (Draft-String) — gleiche Semantik wie isMandatoryFieldUnfilled. */
export function isMandatoryFieldUnfilledFromDisplay(
	field: ISchemaFieldModel,
	displayValue: string
): boolean {
	if (field.minUsage <= 0) {
		return false;
	}
	if (displayValue.trim() !== "") {
		return false;
	}
	return !isFieldNullable(field);
}

// ---------------------------------------------------------------------------
// A) Inhaltliche Validierung
// ---------------------------------------------------------------------------

export function isFieldRuleViolated(field: ISchemaFieldModel, displayValue: string): boolean {
	if (!field.rules || displayValue === "") {
		return false;
	}
	try {
		return !new RegExp(field.rules).test(displayValue);
	} catch {
		return false;
	}
}

export function isMandatoryFieldUnfilled(
	dataRoot: unknown,
	dataPath: string,
	field: ISchemaFieldModel
): boolean {
	if (field.minUsage <= 0) {
		return false;
	}

	const value = getValueByPath(dataRoot, dataPath);
	if (value === undefined) {
		return false;
	}

	return isEmptyFieldValue(value, field);
}

export function getFieldDefaultValue(field: ISchemaFieldModel): unknown | undefined {
	const defaultVal = field.dataStructure?.default;
	if (defaultVal === undefined || defaultVal === null || defaultVal === "") {
		return undefined;
	}

	switch (field.fieldType) {
		case "number":
			return Number(defaultVal);
		case "boolean":
			return String(defaultVal).toLowerCase() === "true";
		case "object":
		case "array":
			try {
				return JSON.parse(defaultVal);
			} catch {
				return defaultVal;
			}
		default:
			return defaultVal;
	}
}

export function getGroupUsageCount(group: ISchemaGroupModel, value: unknown): number {
	if (value == null) {
		return 0;
	}

	if (isArrayCollectionGroup(group)) {
		return Array.isArray(value) ? value.length : 0;
	}

	if (group.collectionType === "map") {
		return getDataEntries(value).length;
	}

	return 1;
}

/** A.c – variable Gruppe außerhalb minUsage/maxUsage */
export function isGroupUsageOutOfBounds(
	dataRoot: unknown,
	path: string,
	group: ISchemaGroupModel
): boolean {
	if (!isVariableGroup(group)) {
		return false;
	}

	const value = getValueByPath(dataRoot, path);

	if (isArrayCollectionGroup(group) && value !== undefined && !Array.isArray(value)) {
		return false;
	}

	if (group.collectionType === "map" && value !== undefined && (value == null || typeof value !== "object" || Array.isArray(value))) {
		return false;
	}

	const count = getGroupUsageCount(group, value);
	return count < group.minUsage || count > group.maxUsage;
}

// ---------------------------------------------------------------------------
// B) Strukturelle Verstöße
// ---------------------------------------------------------------------------

/** Pflichtfeld/Struktur existiert nicht in den Daten */
function isArrayEntryFieldPathAbsent(dataRoot: unknown, dataPath: string): boolean {
	const match = dataPath.match(/^(.+)\[(\d+)\](?:\.|$)/);
	if (!match) {
		return false;
	}

	const arrayPath = match[1];
	const index = parseInt(match[2], 10);
	const array = getValueByPath(dataRoot, arrayPath);
	return !Array.isArray(array) || index >= array.length;
}

export function isFieldStructurallyMissing(
	dataRoot: unknown,
	dataPath: string,
	field: ISchemaFieldModel
): boolean {
	if (field.minUsage <= 0) {
		return false;
	}

	const value = getValueByPath(dataRoot, dataPath);
	if (value !== undefined) {
		return false;
	}

	if (isArrayEntryFieldPathAbsent(dataRoot, dataPath)) {
		return false;
	}

	return true;
}

/** Erforderliche Datenstruktur fehlt oder hat falschen Typ / zu wenige Einträge */
export function isGroupStructurallyMissing(
	dataRoot: unknown,
	path: string,
	group: ISchemaGroupModel
): boolean {
	const value = getValueByPath(dataRoot, path);

	if (
		isSchemaDefinitionItemsList(dataRoot, group.dataStructure.itemName, value) ||
		(isSchemaDocumentElement(dataRoot) &&
			group.dataStructure.itemName === "items" &&
			Array.isArray(value))
	) {
		return false;
	}

	if (value === undefined) {
		return group.minUsage > 0;
	}

	if (isArrayCollectionGroup(group) && !Array.isArray(value)) {
		return true;
	}

	if (isSchemaDocumentElement(dataRoot) && group.dataStructure.itemName === "items") {
		return !Array.isArray(value);
	}

	if (group.collectionType === "map" || isFixedObjectGroup(group)) {
		if (value == null || typeof value !== "object" || Array.isArray(value)) {
			return true;
		}
	}

	const count = getGroupUsageCount(group, value);
	return group.minUsage > 0 && count < group.minUsage;
}

export function findStructuralMissingInScope(
	dataRoot: unknown,
	schemaItems: ISchemaItem[],
	pathPrefix: string
): StructuralMissingEntry[] {
	const entries: StructuralMissingEntry[] = [];

	for (const item of schemaItems) {
		const itemPath = joinPath(pathPrefix, item.dataStructure.itemName);

		if (isSchemaField(item)) {
			if (isFieldStructurallyMissing(dataRoot, itemPath, item)) {
				entries.push({ path: itemPath, kind: "field" });
			}
			continue;
		}

		if (isGroupStructurallyMissing(dataRoot, itemPath, item)) {
			entries.push({ path: itemPath, kind: "group" });
			continue;
		}

		const value = getValueByPath(dataRoot, itemPath);

		if (!shouldValidateGroupContents(item, value)) {
			continue;
		}

		traverseGroupChildren(dataRoot, item, itemPath, value, (childItems, childPath) => {
			entries.push(...findStructuralMissingInScope(dataRoot, childItems, childPath));
		});
	}

	return entries;
}

function hasContentValidationErrorsInScope(
	dataRoot: unknown,
	schemaItems: ISchemaItem[],
	pathPrefix: string
): boolean {
	for (const item of schemaItems) {
		const itemPath = joinPath(pathPrefix, item.dataStructure.itemName);

		if (isSchemaField(item)) {
			if (isMandatoryFieldUnfilled(dataRoot, itemPath, item)) {
				return true;
			}
			const value = getValueByPath(dataRoot, itemPath);
			const displayValue = formatSchemaFieldDisplayValue(value, item.fieldType);
			if (isFieldRuleViolated(item, displayValue)) {
				return true;
			}
			continue;
		}

		if (isGroupUsageOutOfBounds(dataRoot, itemPath, item)) {
			return true;
		}

		const value = getValueByPath(dataRoot, itemPath);
		if (!shouldValidateGroupContents(item, value)) {
			continue;
		}

		let hasNestedError = false;
		traverseGroupChildren(dataRoot, item, itemPath, value, (childItems, childPath) => {
			if (hasSchemaValidationErrorsInScope(dataRoot, childItems, childPath)) {
				hasNestedError = true;
			}
		});
		if (hasNestedError) {
			return true;
		}
	}

	return false;
}

/** Strukturelle + inhaltliche Validierungsfehler im Schema-Bereich */
export function hasSchemaValidationErrorsInScope(
	dataRoot: unknown,
	schemaItems: ISchemaItem[],
	pathPrefix: string
): boolean {
	if (findStructuralMissingInScope(dataRoot, schemaItems, pathPrefix).length > 0) {
		return true;
	}
	return hasContentValidationErrorsInScope(dataRoot, schemaItems, pathPrefix);
}

export function formatExtraValue(value: unknown): string {
	if (value === null) {
		return "null";
	}
	if (value === undefined) {
		return "";
	}
	if (typeof value === "object") {
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	}
	return String(value);
}

// Legacy aliases (interne Aufrufer migrieren)
/** @deprecated Use isMandatoryFieldUnfilled or isFieldStructurallyMissing */
export function isMandatoryFieldMissing(
	dataRoot: unknown,
	dataPath: string,
	field: ISchemaFieldModel
): boolean {
	return (
		isFieldStructurallyMissing(dataRoot, dataPath, field) ||
		isMandatoryFieldUnfilled(dataRoot, dataPath, field)
	);
}

/** @deprecated Use isGroupStructurallyMissing or isGroupUsageOutOfBounds */
export function isMandatoryGroupMissing(
	dataRoot: unknown,
	path: string,
	group: ISchemaGroupModel
): boolean {
	return (
		isGroupStructurallyMissing(dataRoot, path, group) ||
		isGroupUsageOutOfBounds(dataRoot, path, group)
	);
}
