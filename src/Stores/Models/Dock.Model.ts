import { Instance, types } from "mobx-state-tree";

export const DockpartBasedOnEntryModel = types.model("DockpartBasedOnEntry", {
	dockpartId: types.union(types.string, types.number),
});

export const DockpartVersionModel = types.model("DockpartVersion", {
	version: types.string,
});

export const DockpartStateModel = types.model("DockpartState", {
	value: types.optional(types.string, ""),
	timestamp: types.optional(types.string, ""),
	reportedBy: types.optional(types.string, ""),
});

export const DockHintModel = types.model("DockHint", {
	kind: types.string,
	value: types.string,
	detail: types.optional(types.string, ""),
	timestamp: types.optional(types.string, ""),
	reportedBy: types.optional(types.string, ""),
});

export const DOCKPART_CORE_KEYS = [
	"id",
	"type",
	"label",
	"notes",
	"protocol",
	"version",
	"versions",
	"basedOn",
	"state",
	"settings",
] as const;

const DOCKPART_CORE_KEY_SET = new Set<string>(DOCKPART_CORE_KEYS);

function splitDockpartSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> {
	const core: Record<string, unknown> = {};
	const schemaExtensions: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(snapshot)) {
		if (key === "schemaExtensions") {
			continue;
		}
		if (DOCKPART_CORE_KEY_SET.has(key)) {
			core[key] = value;
		} else {
			schemaExtensions[key] = value;
		}
	}

	return { ...core, schemaExtensions };
}

function asOptionalString(value: unknown): string {
	if (value == null) {
		return "";
	}
	return String(value);
}

function normalizeBasedOn(value: unknown): Array<{ dockpartId: string | number }> {
	if (value == null || value === "") {
		return [];
	}
	const items = Array.isArray(value) ? value : [value];
	const result: Array<{ dockpartId: string | number }> = [];
	for (const item of items) {
		if (item == null || item === "") {
			continue;
		}
		if (typeof item === "string" || typeof item === "number") {
			result.push({ dockpartId: item });
			continue;
		}
		if (typeof item !== "object") {
			continue;
		}
		const record = item as Record<string, unknown>;
		if (record.entry != null) {
			result.push(...normalizeBasedOn(record.entry));
			continue;
		}
		const id = record.dockpartId ?? record.id;
		if (typeof id === "string" || typeof id === "number") {
			if (id !== "") {
				result.push({ dockpartId: id });
			}
		}
	}
	return result;
}

function normalizeState(value: unknown): { value: string; timestamp: string; reportedBy: string } {
	if (value == null || typeof value !== "object" || Array.isArray(value)) {
		return { value: "", timestamp: "", reportedBy: "" };
	}
	const record = value as Record<string, unknown>;
	return {
		value: asOptionalString(record.value),
		timestamp: asOptionalString(record.timestamp),
		reportedBy: asOptionalString(record.reportedBy),
	};
}

function normalizeVersions(value: unknown): Array<{ version: string }> {
	if (value == null || value === "") {
		return [];
	}
	const items = Array.isArray(value) ? value : [value];
	return items.flatMap((item) => {
		if (typeof item === "string") {
			return item ? [{ version: item }] : [];
		}
		if (item && typeof item === "object" && "version" in item) {
			const version = asOptionalString((item as { version?: unknown }).version);
			return version ? [{ version }] : [];
		}
		return [];
	});
}

function flattenDockpartSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> {
	const { schemaExtensions, ...core } = snapshot;
	const flat: Record<string, unknown> = { ...core };

	if (schemaExtensions && typeof schemaExtensions === "object" && !Array.isArray(schemaExtensions)) {
		for (const [key, value] of Object.entries(schemaExtensions as Record<string, unknown>)) {
			flat[key] = value;
		}
	}

	return flat;
}

function normalizeIncomingDockpart(snapshot: Record<string, unknown>): Record<string, unknown> {
	const next = { ...snapshot };
	next.id = asOptionalString(next.id);
	next.type = asOptionalString(next.type);
	next.label = asOptionalString(next.label);
	next.notes = asOptionalString(next.notes);
	next.protocol = asOptionalString(next.protocol);
	next.version = asOptionalString(next.version);
	if ((next.version == null || next.version === "") && Array.isArray(next.versions)) {
		const first = next.versions[0] as { version?: string } | string | undefined;
		if (typeof first === "string") {
			next.version = first;
		} else if (first && typeof first === "object" && first.version) {
			next.version = first.version;
		}
	}
	if ((!next.type || next.type === "") && typeof next.protocol === "string") {
		next.type = next.protocol;
	}
	if ((!next.protocol || next.protocol === "") && typeof next.type === "string") {
		next.protocol = next.type;
	}
	const settings =
		next.settings && typeof next.settings === "object" && !Array.isArray(next.settings)
			? { ...(next.settings as Record<string, unknown>) }
			: {};
	const address =
		settings.address && typeof settings.address === "object" && !Array.isArray(settings.address)
			? (settings.address as Record<string, unknown>)
			: undefined;
	if (address) {
		if (settings.ip == null && address.ip != null) {
			settings.ip = address.ip;
		}
		if (settings.netmask == null && address.netmask != null) {
			settings.netmask = address.netmask;
		}
		delete settings.address;
	}
	if (next.state == null && typeof settings.state === "string") {
		next.state = { value: settings.state, timestamp: "", reportedBy: "" };
		delete settings.state;
	}
	next.settings = settings;
	next.basedOn = normalizeBasedOn(next.basedOn);
	next.state = normalizeState(next.state);
	next.versions = normalizeVersions(next.versions);
	return next;
}

/**
 * Dockpart = generischer Kern (XSD) + schema-gesteuerte Erweiterungen in schemaExtensions.
 * getSnapshot/postProcessSnapshot liefern flaches REST-JSON.
 */
export const DockpartModel = types
	.model("Dockpart", {
		id: types.string,
		type: types.optional(types.string, ""),
		label: types.optional(types.string, ""),
		notes: types.optional(types.string, ""),
		protocol: types.optional(types.string, ""),
		version: types.optional(types.string, ""),
		versions: types.optional(types.array(DockpartVersionModel), []),
		basedOn: types.optional(types.array(DockpartBasedOnEntryModel), []),
		state: types.optional(DockpartStateModel, {}),
		settings: types.optional(types.map(types.frozen()), {}),
		schemaExtensions: types.optional(types.map(types.frozen()), {}),
	})
	.preProcessSnapshot((snapshot) => {
		if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
			return snapshot;
		}
		return splitDockpartSnapshot(
			normalizeIncomingDockpart(snapshot as unknown as Record<string, unknown>)
		) as unknown as typeof snapshot;
	})
	.postProcessSnapshot((snapshot) => {
		if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
			return snapshot;
		}
		return flattenDockpartSnapshot(snapshot as unknown as Record<string, unknown>) as unknown as typeof snapshot;
	});

function normalizeHints(value: unknown): Array<Record<string, string>> {
	if (value == null || value === "") {
		return [];
	}
	const items = Array.isArray(value) ? value : [value];
	return items.flatMap((item) => {
		if (!item || typeof item !== "object") {
			return [];
		}
		const record = item as Record<string, unknown>;
		return [
			{
				kind: asOptionalString(record.kind),
				value: asOptionalString(record.value),
				detail: asOptionalString(record.detail),
				timestamp: asOptionalString(record.timestamp),
				reportedBy: asOptionalString(record.reportedBy),
			},
		];
	});
}

/** Dock = Container für Dockparts (COMPONENT-DOCKS-Schema) */
export const DockModel = types
	.model("Dock", {
		id: types.string,
		type: types.optional(types.string, ""),
		label: types.optional(types.string, ""),
		hints: types.optional(types.array(DockHintModel), []),
		dockparts: types.optional(types.array(DockpartModel), []),
	})
	.preProcessSnapshot((snapshot) => {
		if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
			return snapshot;
		}
		const record = snapshot as unknown as Record<string, unknown>;
		const dockparts = record.dockparts;
		return {
			...record,
			id: asOptionalString(record.id),
			type: asOptionalString(record.type),
			label: asOptionalString(record.label),
			hints: normalizeHints(record.hints),
			dockparts: dockparts == null ? [] : Array.isArray(dockparts) ? dockparts : [dockparts],
		} as unknown as typeof snapshot;
	});

export type IDockpart = Instance<typeof DockpartModel>;
export type IDock = Instance<typeof DockModel>;

export function isDockpartNode(node: unknown): node is IDockpart {
	return (
		node != null &&
		typeof node === "object" &&
		"schemaExtensions" in node &&
		typeof (node as IDockpart).schemaExtensions?.get === "function"
	);
}

export function isDockpartCoreKey(key: string): boolean {
	return DOCKPART_CORE_KEY_SET.has(key);
}
