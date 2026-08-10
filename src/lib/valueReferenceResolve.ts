import { IAsset } from "../Stores/Models/Asset.Model";
import { IGroup } from "../Stores/Models/Group.Model";
import { collectDockpartValueSnapshot } from "./connectionSnapshot";
import { formatAssetDisplayName } from "./connectionEndpointRef";
import type { ContextMembership } from "./effectiveDockparts";

export type ValueReferenceKind = "contextValueRef" | "componentRef" | "valueRef";

/**
 * Verweis auf einen Wert statt eines festen Literals.
 * Kontext-Werte stammen aus Groups (contextGroupRef), nicht aus Components.
 * basedOn modelliert Stack-Ebenen — nicht Kontext-Werte.
 */
export type ValueReference = {
	kind: ValueReferenceKind;
	contextGroupRef?: string;
	componentRef?: string;
	field?: string;
	labelSnapshot?: string;
};

export function isValueReference(value: unknown): value is ValueReference {
	if (value == null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	const record = value as Record<string, unknown>;
	const kind = record.kind;
	if (
		kind !== "contextValueRef" &&
		kind !== "componentRef" &&
		kind !== "valueRef"
	) {
		return false;
	}
	if (kind === "contextValueRef") {
		return typeof record.contextGroupRef === "string" && record.contextGroupRef.trim() !== "";
	}
	return typeof record.componentRef === "string" && record.componentRef.trim() !== "";
}

function readGroupSetting(group: IGroup, field: string): unknown {
	if (group.settings && typeof group.settings.get === "function") {
		if (group.settings.has(field)) {
			return group.settings.get(field);
		}
	}
	return undefined;
}

function resolveContextGroupValue(
	contextGroupRef: string,
	field: string | undefined,
	groups: IGroup[]
): unknown {
	const group = groups.find((entry) => entry.id === contextGroupRef.trim());
	if (!group) {
		return undefined;
	}
	if (!field?.trim()) {
		return group.definition?.label?.trim() || group.definition?.name?.trim() || group.id;
	}
	return readGroupSetting(group, field.trim());
}

function resolveImplicitContextGroupRef(
	memberships: ContextMembership[] | undefined,
	explicitRef?: string
): string | undefined {
	const trimmed = explicitRef?.trim();
	if (trimmed) {
		return trimmed;
	}
	return memberships?.find((entry) => entry.contextGroupRef?.trim())?.contextGroupRef?.trim();
}

export type ValueReferenceResolveContext = {
	assets?: IAsset[];
	groups?: IGroup[];
	contextMemberships?: ContextMembership[];
};

export function resolveValueReference(
	value: unknown,
	context: ValueReferenceResolveContext = {}
): unknown {
	if (!isValueReference(value)) {
		return value;
	}

	const { assets = [], groups = [], contextMemberships } = context;

	if (value.kind === "contextValueRef" || value.kind === "valueRef") {
		const groupRef = resolveImplicitContextGroupRef(contextMemberships, value.contextGroupRef);
		if (!groupRef) {
			return value.labelSnapshot ?? "";
		}
		const resolved = resolveContextGroupValue(groupRef, value.field, groups);
		if (resolved !== undefined) {
			return resolveValueReference(resolved, context);
		}
		return value.labelSnapshot ?? groupRef;
	}

	const sourceAsset = assets.find((asset) => asset.id === value.componentRef?.trim());
	if (!sourceAsset) {
		return value.labelSnapshot ?? value.componentRef;
	}

	if (!value.field?.trim()) {
		return formatAssetDisplayName(sourceAsset);
	}

	for (const dock of sourceAsset.docks) {
		for (const part of dock.dockparts) {
			const settings = collectDockpartValueSnapshot(part);
			if (Object.prototype.hasOwnProperty.call(settings, value.field)) {
				return resolveValueReference(settings[value.field], context);
			}
		}
	}

	return value.labelSnapshot ?? formatAssetDisplayName(sourceAsset);
}

export function buildContextValueReference(
	contextGroupRef: string,
	field?: string,
	labelSnapshot?: string
): ValueReference {
	return {
		kind: "contextValueRef",
		contextGroupRef,
		field: field?.trim() || undefined,
		labelSnapshot,
	};
}

export function buildValueReference(
	componentRef: string,
	field?: string,
	labelSnapshot?: string
): ValueReference {
	return {
		kind: field ? "valueRef" : "componentRef",
		componentRef,
		field: field?.trim() || undefined,
		labelSnapshot,
	};
}

export function buildContextValueReferenceFromMembership(
	memberships: ContextMembership[] | undefined,
	field: string,
	labelSnapshot?: string
): ValueReference | undefined {
	const groupRef = resolveImplicitContextGroupRef(memberships);
	if (!groupRef) {
		return undefined;
	}
	return buildContextValueReference(groupRef, field, labelSnapshot);
}
