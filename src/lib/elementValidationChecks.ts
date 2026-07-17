import { ActiveElement, isTreeElement } from "../Interfaces/Element";
import { IRootStore } from "../Stores/Root.Store";
import { resolveElementSettingsSchemaName } from "./elementDefinitionTypes";
import {
	hasSchemaValidationErrorsInScope,
	resolveSchemaValidationScope,
} from "./schemaDeviation";
import { touchedObjectErrorRegistry } from "./touchedObjectErrors";

function hasSchemaSectionErrors(
	element: ActiveElement,
	root: IRootStore,
	schemaName: string,
	pathPrefix: string
): boolean {
	const schema =
		root.configSchemas.findSchemaById(schemaName) ??
		root.configSchemas.findSchemaByType(schemaName, "");
	if (!schema?.items?.length) {
		return false;
	}

	const scope = resolveSchemaValidationScope(schema.items, pathPrefix);
	return hasSchemaValidationErrorsInScope(element, scope.schemaItems, scope.pathPrefix);
}

/** Prüft alle Schema-Editoren im Eigenschaften-Dialog auf Validierungsfehler. */
export function hasActiveElementSchemaValidationErrors(
	root: IRootStore,
	element: ActiveElement | undefined
): boolean {
	if (!element) {
		return false;
	}

	if (element.class === "Connection") {
		return hasElementConnectionValidationErrors(root, element);
	}

	return (
		hasElementSettingsValidationErrors(root, element) ||
		hasSchemaSectionErrors(element, root, "ANY-PROPERTIES", "properties") ||
		hasSchemaSectionErrors(element, root, "ANY-DEFINITION", "") ||
		(element.class === "Asset" && hasElementDocksValidationErrors(root, element))
	);
}

export function hasElementSettingsValidationErrors(
	root: IRootStore,
	element: Exclude<ActiveElement, undefined>
): boolean {
	if (!isTreeElement(element)) {
		return false;
	}
	const schemaId = resolveElementSettingsSchemaName(
		element.definition,
		root.configSchemas.schemaCompat
	);
	if (!schemaId) {
		return false;
	}
	return hasSchemaSectionErrors(element, root, schemaId, "settings");
}

export function hasElementDocksValidationErrors(
	root: IRootStore,
	element: Exclude<ActiveElement, undefined>
): boolean {
	if (element.class !== "Asset") {
		return false;
	}
	return hasSchemaSectionErrors(element, root, "COMPONENT-DOCKS", "");
}

export function hasElementConnectionValidationErrors(
	root: IRootStore,
	element: Exclude<ActiveElement, undefined>
): boolean {
	if (element.class !== "Connection") {
		return false;
	}
	return hasSchemaSectionErrors(element, root, "CONNECTION", "");
}

export function hasElementValidationOrStoreErrors(
	root: IRootStore,
	element: { id: string; definition?: { baseType?: string }; class?: string } | undefined
): boolean {
	if (!element) {
		return false;
	}
	if (touchedObjectErrorRegistry.get(element.id)) {
		return true;
	}
	return hasActiveElementSchemaValidationErrors(root, element as ActiveElement);
}
