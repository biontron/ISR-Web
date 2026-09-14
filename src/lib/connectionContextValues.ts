import { IDockpart } from "../Stores/Models/Dock.Model";
import { parseValueRef } from "./connectionValueRef";
import { connectionLayerColor } from "./connectionLayerColor";
import { normalizeDockpartType } from "./dockpartBasedOn";

export type ContextValueDockpartRef = {
	id: string | number;
	type?: string | null;
	protocol?: string | null;
	label?: string | null;
};

export type ContextValueHost = {
	id: string;
	docks?: ReadonlyArray<{
		id: string;
		type?: string;
		label?: string;
		dockparts?: ReadonlyArray<ContextValueDockpartRef>;
	}>;
};

export type ContextValue = {
	contextId: string;
	valueId: string;
	dockId: string;
	type: string;
	label: string;
	color: string;
};

export function collectContextValues(host: ContextValueHost | undefined | null): ContextValue[] {
	if (!host) {
		return [];
	}
	const values: ContextValue[] = [];
	for (const dock of host.docks ?? []) {
		for (const part of dock.dockparts ?? []) {
			const type = String(part.type || part.protocol || "").trim();
			values.push({
				contextId: host.id,
				valueId: String(part.id),
				dockId: String(dock.id),
				type,
				label: part.label?.trim() || type || String(part.id),
				color: connectionLayerColor(type),
			});
		}
	}
	return values;
}

export function findContextValue(
	hosts: ReadonlyArray<ContextValueHost>,
	valueRef: string | undefined | null
): ContextValue | undefined {
	const parsed = parseValueRef(valueRef);
	if (!parsed) {
		return undefined;
	}
	const host = hosts.find((entry) => entry.id === parsed.contextId);
	if (!host) {
		return undefined;
	}
	return collectContextValues(host).find((value) => value.valueId === parsed.valueId);
}

export function matchingContextValuesForDockpart(
	hosts: ReadonlyArray<ContextValueHost>,
	part: Pick<IDockpart, "type" | "protocol">
): ContextValue[] {
	const matchType = normalizeDockpartType(part.protocol || part.type);
	if (!matchType) {
		return hosts.flatMap((host) => collectContextValues(host));
	}
	return hosts
		.flatMap((host) => collectContextValues(host))
		.filter((value) => normalizeDockpartType(value.type) === matchType);
}

export function isContextValueHost(host: ContextValueHost | undefined | null): boolean {
	return collectContextValues(host).length > 0;
}
