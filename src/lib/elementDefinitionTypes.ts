import { ISchemaModel } from "../Stores/Models/Schema.Model";

/**
 * Typ-Ebenen (nicht verwechseln):
 * - element.class (MST): Asset | Group | View — Store-Typ
 * - definition.storeType: Element-Speicher-Kategorie VIEWGROUP | COMPONENT
 * - Schema.storeType (REST-Sammlung): INTERNAL | VIEWGROUP | COMPONENT | DOCKPART
 * - definition.baseType: Element-Art GROUP | COMPONENT | CONNECTION | TEMPLATE
 * - definition.type: logischer Schema-Typ (DEVICE, VIEW, …)
 * - definition.subType: optionaler Untertyp vom REST-Schema (nicht Schema-ID)
 */

export const APPLICATION_ASSIGNED_DEFINITION_FIELD_NAMES = new Set([
	"storeType",
	"baseType",
	"type",
	"subType",
]);

const APPLICATION_ASSIGNED_DEFINITION_PATHS = new Set([
	"definition.storeType",
	"definition.baseType",
	"definition.type",
	"definition.subType",
]);

export const ELEMENT_DEFINITION_FIELD_PATH_ALIASES: Record<string, string> = {};

export type ElementDefinitionTypeFields = {
	storeType?: string;
	baseType?: string;
	type?: string;
	subType?: string;
};

export type ElementDefinitionForCreate = {
	storeType: string;
	baseType: string;
	type: string;
	subType: string;
};

/** Fester `definition.name`-Platzhalter bei Neuanlage (logische und physische Gruppen). */
export const NEW_ELEMENT_DEFINITION_NAME = "New";

export function isAssetDefinitionDataPath(dataPath: string): boolean {
	return dataPath === "definition" || dataPath.startsWith("definition.");
}

function trimField(value: string | undefined): string {
	const trimmed = value?.trim() ?? "";
	if (trimmed.toLowerCase() === "null") {
		return "";
	}
	return trimmed;
}

/** Logischer Typ aus Schema — Legacy: type=GROUP/Kategorie, id=AREA/DEVICE/… */
export function resolveSchemaLogicalType(
	schema: Pick<ISchemaModel, "id" | "type" | "baseType">
): string {
	const schemaType = trimField(schema.type);
	if (schemaType && !ELEMENT_KIND_VALUES.has(schemaType)) {
		return schemaType;
	}
	const schemaId = trimField(schema.id);
	if (
		schemaId &&
		!ELEMENT_KIND_VALUES.has(schemaId) &&
		!LEGACY_STORE_TYPES.has(schemaId)
	) {
		return schemaId;
	}
	return schemaType;
}

const LEGACY_STORE_TYPES = new Set(["ELEMENT"]);
const ELEMENT_KIND_VALUES = new Set(["GROUP", "COMPONENT", "CONNECTION", "TEMPLATE"]);

/** Legacy-Schema: baseType=ELEMENT, type=GROUP|… → Element-Art für Abgleich. */
export function normalizeSchemaElementKind(
	schema: Pick<ISchemaModel, "baseType" | "type">
): string {
	const category = trimField(schema.type);
	if (category === "GROUP") {
		return "GROUP";
	}
	if (category === "COMPONENT" || category === "ELEMENT") {
		return "COMPONENT";
	}
	const base = normalizeElementKindForSchemaMatch(schema.baseType);
	if (ELEMENT_KIND_VALUES.has(base)) {
		return base;
	}
	return base;
}

/** Legacy: ELEMENT/ASSET in definition.baseType → COMPONENT für Schema-Abgleich. */
export function normalizeElementKindForSchemaMatch(value: string | undefined): string {
	const trimmed = trimField(value);
	if (trimmed === "ELEMENT" || trimmed === "ASSET") {
		return "COMPONENT";
	}
	return trimmed;
}

/** Anzeige der Element-Art (baseType) — Legacy-ELEMENT→COMPONENT, sonst MST-Wert. */
export function resolveElementKindDisplay(
	definition: ElementDefinitionTypeFields | undefined,
	elementClass?: string
): string {
	const base = trimField(definition?.baseType);
	if (base && ELEMENT_KIND_VALUES.has(base)) {
		return base;
	}
	const normalized = normalizeElementKindForSchemaMatch(base);
	if (normalized && ELEMENT_KIND_VALUES.has(normalized)) {
		return normalized;
	}
	if (elementClass === "Asset") {
		return "COMPONENT";
	}
	if (
		elementClass === "Group" ||
		elementClass === "GROUP" ||
		elementClass === "View" ||
		elementClass === "VIEW"
	) {
		return "GROUP";
	}
	return base;
}

function effectiveDefinitionType(definition: ElementDefinitionTypeFields): string {
	return trimField(definition.type) || resolveAssetElementType(definition);
}

export function definitionMatchesSchema(
	definition: ElementDefinitionTypeFields,
	schema: Pick<ISchemaModel, "baseType" | "type" | "subType">,
	options?: { ignoreBaseType?: boolean }
): boolean {
	const type = effectiveDefinitionType(definition);
	const subType = trimField(definition.subType);
	if (!options?.ignoreBaseType) {
		const defBase = normalizeElementKindForSchemaMatch(definition.baseType);
		const schemaBase = normalizeSchemaElementKind(schema);
		if (defBase !== schemaBase) {
			return false;
		}
	}
	return type === trimField(schema.type) && subType === trimField(schema.subType);
}

export function findSchemaForDefinition(
	schemas: ISchemaModel[],
	definition: ElementDefinitionTypeFields | undefined
): ISchemaModel | undefined {
	if (!definition) {
		return undefined;
	}

	const strict = schemas.find((schema) => definitionMatchesSchema(definition, schema));
	if (strict) {
		return strict;
	}

	const legacySubType = trimField(definition.subType);
	const defKind = normalizeElementKindForSchemaMatch(definition.baseType);
	if (legacySubType) {
		const byLegacyId = schemas.find((schema) => schema.id === legacySubType);
		if (byLegacyId) {
			return byLegacyId;
		}
		const bySchemaSubType = schemas.filter(
			(schema) => trimField(schema.subType) === legacySubType
		);
		if (ELEMENT_KIND_VALUES.has(defKind)) {
			const kindSubTypeMatches = bySchemaSubType.filter(
				(schema) => normalizeSchemaElementKind(schema) === defKind
			);
			if (kindSubTypeMatches.length === 1) {
				return kindSubTypeMatches[0];
			}
		}
		if (bySchemaSubType.length === 1) {
			return bySchemaSubType[0];
		}
		const byLogicalType = schemas.filter(
			(schema) => resolveSchemaLogicalType(schema) === legacySubType
		);
		if (ELEMENT_KIND_VALUES.has(defKind)) {
			const kindLogicalMatches = byLogicalType.filter(
				(schema) => normalizeSchemaElementKind(schema) === defKind
			);
			if (kindLogicalMatches.length === 1) {
				return kindLogicalMatches[0];
			}
		}
		if (byLogicalType.length === 1) {
			return byLogicalType[0];
		}
	}

	const legacyBaseType = trimField(definition.baseType);
	if (
		legacyBaseType &&
		!ELEMENT_KIND_VALUES.has(legacyBaseType) &&
		!LEGACY_STORE_TYPES.has(legacyBaseType)
	) {
		const byLegacyBaseId = schemas.find((schema) => schema.id === legacyBaseType);
		if (byLegacyBaseId) {
			return byLegacyBaseId;
		}
	}

	const type = effectiveDefinitionType(definition);
	const subType = trimField(definition.subType);
	if (type) {
		const byType = schemas.filter((schema) => trimField(schema.type) === type);
		if (subType) {
			const byTypeSub = byType.filter(
				(schema) =>
					definitionMatchesSchema(definition, schema, { ignoreBaseType: true }) ||
					trimField(schema.subType) === subType ||
					schema.id === subType
			);
			if (byTypeSub.length === 1) {
				return byTypeSub[0];
			}
		}
		if (byType.length === 1) {
			return byType[0];
		}
	}

	if (ELEMENT_KIND_VALUES.has(defKind)) {
		const kindMatches = schemas.filter(
			(schema) => normalizeSchemaElementKind(schema) === defKind
		);
		const logicalType = trimField(definition.type);
		if (logicalType) {
			const byLogicalType = kindMatches.filter(
				(schema) => trimField(schema.type) === logicalType || schema.id === logicalType
			);
			if (subType) {
				const bySub = byLogicalType.filter(
					(schema) =>
						trimField(schema.subType) === subType || schema.id === subType
				);
				if (bySub.length === 1) {
					return bySub[0];
				}
			}
			if (byLogicalType.length === 1) {
				return byLogicalType[0];
			}
		}
		if (subType) {
			const bySubId = kindMatches.filter((schema) => schema.id === subType);
			if (bySubId.length === 1) {
				return bySubId[0];
			}
		}
	}

	return undefined;
}

/** Definition-Felder für Neuanlage — Typ-Felder aus Schema; storeType siehe spezifische Resolver. */
export function resolveElementDefinitionTypesForCreate(
	schema: ISchemaModel
): ElementDefinitionForCreate {
	return {
		storeType: schema.storeType,
		baseType: schema.baseType,
		type: schema.type,
		subType: schema.subType ?? "",
	};
}

export type ElementCreateTarget = "view" | "group" | "asset";

/** Ziel-Store für Neuanlage aus Schema-Sammlung + Element-Art. */
export function resolveCreateTargetForSchema(schema: ISchemaModel): ElementCreateTarget {
	const kind = normalizeSchemaElementKind(schema);
	const schemaStoreType = trimField(schema.storeType).toUpperCase();

	if (kind === "GROUP" && trimField(schema.type) === "VIEW") {
		return "view";
	}
	if (schemaStoreType === "VIEWGROUP" || schemaStoreType === "INTERNAL") {
		if (kind === "GROUP") {
			return "group";
		}
	}
	return "asset";
}

/** View-Gruppe unter /views/.../groups — storeType VIEWGROUP. */
export function resolveGroupDefinitionTypesForCreate(
	schema: ISchemaModel
): ElementDefinitionForCreate {
	const base = resolveElementDefinitionTypesForCreate(schema);
	return {
		...base,
		storeType: "VIEWGROUP",
		baseType: normalizeSchemaElementKind(schema) === "GROUP" ? "GROUP" : base.baseType,
	};
}

/** View-Wurzel — storeType VIEWGROUP. */
export function resolveViewDefinitionTypesForCreate(
	schema: ISchemaModel
): ElementDefinitionForCreate {
	return {
		storeType: "VIEWGROUP",
		baseType: "GROUP",
		type: "VIEW",
		subType: schema.subType ?? "",
	};
}

/** Komponente unter /environments/.../assets — storeType COMPONENT. */
export function resolveComponentDefinitionTypesForCreate(
	schema: ISchemaModel
): ElementDefinitionForCreate {
	const base = resolveElementDefinitionTypesForCreate(schema);
	return {
		...base,
		storeType: "COMPONENT",
	};
}

/** @deprecated Nutze resolveComponentDefinitionTypesForCreate */
export function resolveAssetDefinitionTypesForCreate(
	selectedSchemaId: string,
	schema: ISchemaModel | undefined
): ElementDefinitionForCreate {
	if (!schema) {
		throw new Error(`Element-Schema '${selectedSchemaId}' nicht gefunden.`);
	}
	return resolveComponentDefinitionTypesForCreate(schema);
}

/** @deprecated */
export function resolveElementDefinitionTypesFromSchema(
	schemaId: string,
	findSchema: (id: string) => ISchemaModel | undefined
): ElementDefinitionForCreate {
	const schema = findSchema(schemaId);
	if (!schema) {
		throw new Error(`Element-Schema '${schemaId}' nicht gefunden.`);
	}
	return resolveElementDefinitionTypesForCreate(schema);
}

export function resolveAssetElementType(
	definition: ElementDefinitionTypeFields | undefined
): string {
	if (!definition) {
		return "";
	}
	const type = trimField(definition.type);
	if (type && !ELEMENT_KIND_VALUES.has(type)) {
		return type;
	}
	const baseType = trimField(definition.baseType);
	if (baseType && !ELEMENT_KIND_VALUES.has(baseType) && !LEGACY_STORE_TYPES.has(baseType)) {
		return baseType;
	}
	return "";
}

/** Logischer Typ (definition.type) — ignoriert Element-Art in type; optional Schema-Fallback. */
export function resolveElementTypeDisplay(
	definition: ElementDefinitionTypeFields | undefined,
	schemas?: readonly ISchemaModel[]
): string {
	const direct = resolveAssetElementType(definition);
	if (direct) {
		return direct;
	}
	if (schemas && definition) {
		const schema = findSchemaForDefinition([...schemas], definition);
		if (schema) {
			const logicalType = resolveSchemaLogicalType(schema);
			if (logicalType && !ELEMENT_KIND_VALUES.has(logicalType)) {
				return logicalType;
			}
		}
		const subType = trimField(definition.subType);
		if (
			subType &&
			normalizeElementKindForSchemaMatch(definition.baseType) === "GROUP" &&
			!ELEMENT_KIND_VALUES.has(subType)
		) {
			return subType;
		}
	}
	return "";
}

/** storeType (Schema-REST-Sammlung), Legacy: ELEMENT→COMPONENT in baseType-Feld */
export function resolveAssetSchemaStoreType(
	definition: ElementDefinitionTypeFields | undefined
): string {
	const storeType = trimField(definition?.storeType);
	if (storeType) {
		return storeType === "ELEMENT" ? "COMPONENT" : storeType;
	}
	const legacyBase = trimField(definition?.baseType);
	if (legacyBase === "ELEMENT") {
		return "COMPONENT";
	}
	if (legacyBase === "INTERNAL" || legacyBase === "DOCKPART") {
		return legacyBase;
	}
	return "";
}

/** @deprecated Nutze resolveAssetSchemaStoreType */
export function resolveAssetSchemaCategory(
	definition: ElementDefinitionTypeFields | undefined
): string {
	return resolveAssetSchemaStoreType(definition);
}

export function formatAssetDefinitionTypeLabel(
	definition: ElementDefinitionTypeFields | undefined
): string {
	if (!definition) {
		return "";
	}
	const elementType = resolveAssetElementType(definition);
	const subType = trimField(definition.subType);
	if (elementType && subType) {
		return `${elementType}/${subType}`;
	}
	return elementType || subType || resolveAssetSchemaStoreType(definition) || "";
}

export function resolveElementSchemaIconCandidates(
	definition: ElementDefinitionTypeFields | undefined
): string[] {
	if (!definition) {
		return [];
	}
	const candidates: string[] = [];
	const push = (value?: string) => {
		if (value && !candidates.includes(value)) {
			candidates.push(value);
		}
	};
	push(definition.subType);
	push(definition.type);
	const baseType = trimField(definition.baseType);
	if (baseType && !ELEMENT_KIND_VALUES.has(baseType) && !LEGACY_STORE_TYPES.has(baseType)) {
		push(baseType);
	}
	return candidates;
}

/** Schema-ID für Settings-Editor: Tripel-Match, Legacy subType=Schema-ID. */
export function resolveElementSettingsSchemaName(
	definition: ElementDefinitionTypeFields | undefined,
	schemas: ISchemaModel[]
): string {
	return findSchemaForDefinition(schemas, definition)?.id ?? "";
}

/** @deprecated Nutze resolveElementSettingsSchemaName */
export function resolveElementSchemaLookupId(
	definition: ElementDefinitionTypeFields | undefined
): string {
	return trimField(definition?.subType);
}

export function resolveElementSchemaParentType(
	definition: ElementDefinitionTypeFields | undefined
): string {
	if (!definition) {
		return "";
	}
	const type = trimField(definition.type);
	if (type) {
		return type;
	}
	const baseType = trimField(definition.baseType);
	if (baseType && ELEMENT_KIND_VALUES.has(baseType)) {
		return baseType === "COMPONENT" ? "COMPONENT" : baseType;
	}
	return baseType;
}

const TREE_ELEMENT_CLASSES = new Set(["Asset", "Group", "View"]);

export function isApplicationAssignedDefinitionField(
	elementData: { class?: string },
	fieldItemName: string,
	dataPath: string
): boolean {
	if (!elementData.class || !TREE_ELEMENT_CLASSES.has(elementData.class)) {
		return false;
	}
	if (!APPLICATION_ASSIGNED_DEFINITION_PATHS.has(dataPath)) {
		return false;
	}
	return APPLICATION_ASSIGNED_DEFINITION_FIELD_NAMES.has(fieldItemName);
}
