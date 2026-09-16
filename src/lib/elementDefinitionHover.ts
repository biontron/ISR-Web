import type { ElementIdRef } from "./elementAssignments";

/** Hover-Menü aus XSD `ElementIdRefType` plus optionale Anzeige-Felder. */
export type ElementDefinitionHoverFields = Partial<ElementIdRef> & {
	description?: string;
	status?: string;
	className?: string;
	environment?: string;
};

export type ElementDefinitionHoverRow = {
	label: string;
	value: string;
};

export function buildElementDefinitionHoverRows(
	fields: ElementDefinitionHoverFields
): ElementDefinitionHoverRow[] {
	return [
		{ label: "Umgebung", value: fields.environment || fields.environmentId || "—" },
		{ label: "Type", value: fields.baseType || fields.className || "—" },
		{ label: "Subtype", value: fields.type || "—" },
		{ label: "Name", value: fields.name || "—" },
		{ label: "Label", value: fields.label || "—" },
		{ label: "Descripton", value: fields.description || "—" },
		{ label: "ID", value: fields.id || "—" },
		{ label: "Status", value: fields.status || "—" },
	];
}

export function elementDefinitionHoverTitle(fields: ElementDefinitionHoverFields): string {
	const heading = `${fields.className ?? fields.baseType ?? "???"} — ${fields.name ?? "???"}`;
	return fields.label ? `${heading}\n${fields.label}` : heading;
}
