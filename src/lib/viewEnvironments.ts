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

/** Environment-IDs, die eine View lädt. Ohne Bindung: Legacy-München, damit Demo nicht leer aufgeht. */
export function resolveViewEnvironmentRefs(view?: ViewEnvironmentSource | null): string[] {
	const refs = readViewEnvironmentBindings(view).map((entry) => entry.ref);
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

/** Schreibziel für neue Komponenten: Auswahl, sonst Primary. */
export function resolveCreateEnvironmentTarget(
	view?: ViewEnvironmentSource | null,
	selectedRef?: string | null
): string {
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
	const fromActive = readViewEnvironmentBindings(activeView);
	if (fromActive.length > 0) {
		return fromActive;
	}
	const first = availableIds.find((id) => trimRef(id));
	return first ? [{ ref: first, primary: true }] : [];
}
