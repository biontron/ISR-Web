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
export function buildSchemaEditorSchemaPath(pathPrefix: string, itemName: string): string {
	return appendSchemaSegment(pathPrefix || "", itemName.trim(), false);
}

/** MST-Datenpfad inkl. itemName — entspricht getValueByPath/setValueByPath. */
export function buildSchemaEditorMstPath(pathPrefix: string, itemName: string): string {
	return appendSchemaSegment(pathPrefix || "", itemName.trim(), true);
}
