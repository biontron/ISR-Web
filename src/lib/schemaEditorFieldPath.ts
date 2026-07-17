import { buildDockpartDataPath } from "./dockpartDataPath";

function appendSchemaSegment(
	parent: string,
	segment: string,
	resolveDataPath: boolean
): string {
	if (!segment) {
		return parent;
	}
	if (!parent) {
		return segment;
	}
	if (
		parent === segment ||
		parent.endsWith(`.${segment}`) ||
		parent.endsWith(`].${segment}`)
	) {
		return parent;
	}
	if (resolveDataPath) {
		return buildDockpartDataPath(parent, segment);
	}
	return `${parent}.${segment}`;
}

/** Kumulierter Schema-Pfad (Definition) inkl. itemName — ohne MST/settings-Mapping. */
export function buildSchemaEditorSchemaPath(
	dataEntryPath: string,
	pathPrefix: string,
	itemName: string
): string {
	const parent = pathPrefix || dataEntryPath || "";
	return appendSchemaSegment(parent, itemName.trim(), false);
}

/** MST-Datenpfad inkl. itemName — entspricht getValueByPath/setValueByPath. */
export function buildSchemaEditorMstPath(
	dataEntryPath: string,
	pathPrefix: string,
	itemName: string
): string {
	const parent = pathPrefix || dataEntryPath || "";
	return appendSchemaSegment(parent, itemName.trim(), true);
}
