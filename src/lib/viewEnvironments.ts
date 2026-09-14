export const LEGACY_ENVIRONMENT_ID = "01e93fa0-1c74-44b1-bafd-6d8a988fea01";

/** Collection-/REST-ID einer View: Anzeigename, klein, nur a-z 0-9 _ - */
export function slugViewCollectionId(name: string): string {
	return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64);
}

export type ViewEnvironmentBinding = {
	ref: string;
	primary?: boolean;
};

export type ViewEnvironmentSource = {
	environments?: ReadonlyArray<ViewEnvironmentBinding | { ref?: unknown; primary?: unknown }>;
};

function trimRef(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

export function readViewEnvironmentBindings(view?: ViewEnvironmentSource | null): ViewEnvironmentBinding[] {
	const raw = view?.environments ?? [];
	const seen = new Set<string>();
	const bindings: ViewEnvironmentBinding[] = [];
	for (const entry of raw) {
		const ref = trimRef((entry as ViewEnvironmentBinding)?.ref);
		if (!ref || seen.has(ref)) {
			continue;
		}
		seen.add(ref);
		bindings.push({
			ref,
			primary: Boolean((entry as ViewEnvironmentBinding)?.primary),
		});
	}
	return bindings;
}

export function knownEnvironmentIds(root?: {
	environments?: { environments?: ReadonlyArray<{ id: string }> };
} | null): string[] {
	return (root?.environments?.environments ?? []).map((entry) => entry.id);
}

/** Erste ID, die in knownIds vorkommt; sonst das erste bekannte Environment. */
export function pickKnownEnvironmentId(
	knownIds: ReadonlyArray<string>,
	...candidates: Array<string | null | undefined>
): string {
	const known: string[] = [];
	const seen = new Set<string>();
	for (const id of knownIds) {
		const trimmed = typeof id === "string" ? id.trim() : "";
		if (!trimmed || seen.has(trimmed)) {
			continue;
		}
		seen.add(trimmed);
		known.push(trimmed);
	}
	for (const candidate of candidates) {
		const id = typeof candidate === "string" ? candidate.trim() : "";
		if (id && seen.has(id)) {
			return id;
		}
	}
	return known[0] ?? "";
}

/**
 * Schreib-/URL-Ziel: nur Environments, die GET /environments geliefert hat.
 * View-Bindungen oder Store-IDs, die dort fehlen, werden nicht verwendet.
 */
export function resolveWriteEnvironmentId(
	knownIds: ReadonlyArray<string>,
	view?: ViewEnvironmentSource | null,
	...preferred: Array<string | null | undefined>
): string {
	const bindings = readViewEnvironmentBindings(view);
	return pickKnownEnvironmentId(
		knownIds,
		...preferred,
		bindings.find((entry) => entry.primary)?.ref,
		bindings[0]?.ref,
		LEGACY_ENVIRONMENT_ID
	);
}

/** Environment-IDs, die eine View lädt. Ohne Bindung: Legacy-München, damit Demo nicht leer aufgeht. */
export function resolveViewEnvironmentRefs(
	view?: ViewEnvironmentSource | null,
	knownIds?: ReadonlyArray<string>
): string[] {
	const refs = readViewEnvironmentBindings(view).map((entry) => entry.ref);
	if (knownIds && knownIds.length > 0) {
		const matched = refs.filter((ref) => knownIds.includes(ref));
		if (matched.length > 0) {
			return matched;
		}
		const fallback = pickKnownEnvironmentId(knownIds, LEGACY_ENVIRONMENT_ID);
		return fallback ? [fallback] : [];
	}
	if (refs.length > 0) {
		return refs;
	}
	return [LEGACY_ENVIRONMENT_ID];
}

export function resolvePrimaryEnvironmentRef(view?: ViewEnvironmentSource | null): string {
	const bindings = readViewEnvironmentBindings(view);
	const marked = bindings.find((entry) => entry.primary)?.ref;
	if (marked) {
		return marked;
	}
	if (bindings[0]?.ref) {
		return bindings[0].ref;
	}
	return LEGACY_ENVIRONMENT_ID;
}

export function withSinglePrimary(
	bindings: ViewEnvironmentBinding[],
	primaryRef: string
): ViewEnvironmentBinding[] {
	return bindings.map((entry) => ({
		ref: entry.ref,
		primary: entry.ref === primaryRef,
	}));
}

export function viewRequiresEnvironmentPicker(view?: ViewEnvironmentSource | null): boolean {
	return readViewEnvironmentBindings(view).length > 1;
}

/** Schreibziel für neue Komponenten: bekannte Environments, sonst Primary. */
export function resolveCreateEnvironmentTarget(
	view?: ViewEnvironmentSource | null,
	selectedRef?: string | null,
	knownIds: ReadonlyArray<string> = []
): string {
	if (knownIds.length > 0) {
		return resolveWriteEnvironmentId(knownIds, view, selectedRef);
	}
	const selected = trimRef(selectedRef);
	const refs = resolveViewEnvironmentRefs(view);
	if (selected && refs.includes(selected)) {
		return selected;
	}
	return resolvePrimaryEnvironmentRef(view);
}

export function defaultBindingsForNewView(
	activeView?: ViewEnvironmentSource | null,
	availableIds: ReadonlyArray<string> = []
): ViewEnvironmentBinding[] {
	const known = new Set(availableIds.map((id) => trimRef(id)).filter(Boolean));
	const fromActive = readViewEnvironmentBindings(activeView).filter((entry) => known.has(entry.ref));
	if (fromActive.length > 0) {
		return fromActive;
	}
	const first = availableIds.find((id) => trimRef(id));
	return first ? [{ ref: first, primary: true }] : [];
}
