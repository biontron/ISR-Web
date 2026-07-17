import { Instance, types } from "mobx-state-tree";

export const DockpartBasedOnEntryModel = types.model("DockpartBasedOnEntry", {
	dockpartId: types.union(types.string, types.number),
});

export const DockpartVersionModel = types.model("DockpartVersion", {
	version: types.string,
});

export const DOCKPART_CORE_KEYS = [
	"id",
	"type",
	"label",
	"protocol",
	"versions",
	"basedOn",
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

/**
 * Dockpart = generischer Kern (XSD) + schema-gesteuerte Erweiterungen in schemaExtensions.
 * getSnapshot/postProcessSnapshot liefern flaches REST-JSON (address/port auf Top-Level).
 */
export const DockpartModel = types
	.model("Dockpart", {
		id: types.string,
		type: types.optional(types.string, ""),
		label: types.optional(types.string, ""),
		protocol: types.optional(types.string, ""),
		versions: types.optional(types.array(DockpartVersionModel), []),
		basedOn: types.optional(types.array(DockpartBasedOnEntryModel), []),
		settings: types.optional(types.map(types.frozen()), {}),
		schemaExtensions: types.optional(types.map(types.frozen()), {}),
	})
	.preProcessSnapshot((snapshot) => {
		if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
			return snapshot;
		}
		return splitDockpartSnapshot(snapshot as unknown as Record<string, unknown>) as unknown as typeof snapshot;
	})
	.postProcessSnapshot((snapshot) => {
		if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
			return snapshot;
		}
		return flattenDockpartSnapshot(snapshot as unknown as Record<string, unknown>) as unknown as typeof snapshot;
	});

/** Dock = Container für Dockparts (COMPONENT-DOCKS-Schema) */
export const DockModel = types.model("Dock", {
	id: types.string,
	type: types.optional(types.string, ""),
	label: types.optional(types.string, ""),
	dockparts: types.optional(types.array(DockpartModel), []),
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
