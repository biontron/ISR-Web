import type { ElementIdRef } from "./elementAssignments";
import { operationalStatusLabel } from "./operationalStatus";

/** Hover-Menü aus XSD `ElementIdRefType` plus optionale Anzeige-Felder. */
export type ElementDefinitionHoverFields = Partial<ElementIdRef> & {
	description?: string;
	status?: string;
	/** Betriebsstatus aus der Resource component-status, zugeordnet über die Component-ID. */
	operationalStatus?: string;
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
	const rows: ElementDefinitionHoverRow[] = [
		{ label: "Umgebung", value: fields.environment || fields.environmentId || "—" },
		{ label: "Type", value: fields.baseType || fields.className || "—" },
		{ label: "Subtype", value: fields.type || "—" },
		{ label: "Name", value: fields.name || "—" },
		{ label: "Label", value: fields.label || "—" },
		{ label: "Descripton", value: fields.description || "—" },
		{ label: "ID", value: fields.id || "—" },
		{ label: "Status", value: fields.status || "—" },
	];
	if (fields.operationalStatus) {
		rows.push({
			label: "Betrieb",
			value: operationalStatusLabel(fields.operationalStatus),
		});
	}
	return rows;
}

export function elementDefinitionHoverTitle(fields: ElementDefinitionHoverFields): string {
	const heading = `${fields.className ?? fields.baseType ?? "???"} — ${fields.name ?? "???"}`;
	return fields.label ? `${heading}\n${fields.label}` : heading;
}

/** Hover-Felder direkt aus einem gespeicherten `elementIdRefs`-Eintrag. */
export function hoverFieldsFromElementIdRef(
	ref: Partial<ElementIdRef>
): ElementDefinitionHoverFields {
	return {
		environmentId: ref.environmentId,
		id: ref.id,
		baseType: ref.baseType,
		type: ref.type,
		subType: ref.subType,
		name: ref.name,
		label: ref.label,
		className: ref.baseType || "Asset",
	};
}

type LiveHoverElement = {
	id: string;
	class?: string;
	status?: string;
	environmentId?: string | null;
	definition?: {
		baseType?: string;
		type?: string;
		subType?: string;
		name?: string;
		label?: string;
		description?: string;
	};
};

/** Hover-Felder aus einem geladenen Element (Suche, Kandidaten). */
export function hoverFieldsFromLiveElement(
	element: LiveHoverElement,
	extras?: { environment?: string }
): ElementDefinitionHoverFields {
	const definition = element.definition ?? {};
	const isConnection = element.class === "Connection";
	return {
		id: element.id,
		environmentId: typeof element.environmentId === "string" ? element.environmentId : "",
		environment: extras?.environment,
		baseType: definition.baseType,
		type: isConnection ? undefined : definition.type,
		subType: definition.subType,
		name: definition.name || (isConnection ? definition.label : undefined),
		label: definition.label,
		description: definition.description,
		status: element.status,
		className: element.class,
	};
}
