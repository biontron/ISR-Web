type NamedElement = {
	id?: string;
	definition?: { name?: string } | null;
};

function elementSortName(element: NamedElement): string {
	const name = element.definition?.name?.trim() ?? "";
	return name || element.id || "";
}

/** Anzeigereihenfolge: Name, deutsch, zahlenbewusst. Gleiche Namen nach Id. */
export function compareByElementName(left: NamedElement, right: NamedElement): number {
	const byName = elementSortName(left).localeCompare(elementSortName(right), "de", {
		numeric: true,
		sensitivity: "base",
	});
	if (byName !== 0) {
		return byName;
	}
	return (left.id || "").localeCompare(right.id || "", "de");
}

const CHILD_ORDER_KEY = "childOrder";

type ChildOrderSource = {
	settings?: { get?: (key: string) => unknown } | Record<string, unknown> | null;
};

/** Gespeicherte Reihenfolge aus dem Verknüpfen-Dialog. Leer heißt: alphabetisch anzeigen. */
export function readChildOrder(element: ChildOrderSource | null | undefined): string[] | null {
	const settings = element?.settings;
	if (!settings) {
		return null;
	}
	const value =
		typeof (settings as { get?: (key: string) => unknown }).get === "function"
			? (settings as { get: (key: string) => unknown }).get(CHILD_ORDER_KEY)
			: (settings as Record<string, unknown>)[CHILD_ORDER_KEY];
	if (!Array.isArray(value)) {
		return null;
	}
	const ids = value.filter((id): id is string => typeof id === "string" && id.trim() !== "");
	return ids.length > 0 ? ids : null;
}

export function childOrderEpoch(
	items: ReadonlyArray<ChildOrderSource>
): string {
	return items.map((item) => (readChildOrder(item) ?? []).join(",")).join("|");
}

/** Ohne gespeicherte Folge alphabetisch. Neue Ids hängen hinten an, die Hand-Reihenfolge bleibt. */
export function orderByChildSequence<T extends NamedElement>(items: readonly T[], stored: string[] | null): T[] {
	if (!stored || stored.length === 0) {
		return [...items].sort(compareByElementName);
	}
	const byId = new Map<string, T>();
	for (const item of items) {
		if (item.id && !byId.has(item.id)) {
			byId.set(item.id, item);
		}
	}
	const ordered: T[] = [];
	const used = new Set<string>();
	for (const id of stored) {
		const item = byId.get(id);
		if (!item || used.has(id)) {
			continue;
		}
		ordered.push(item);
		used.add(id);
	}
	const rest = items.filter((item) => item.id && !used.has(item.id)).sort(compareByElementName);
	return [...ordered, ...rest];
}

/** Erste Zuordnung sortiert alles alphabetisch. Danach bleiben gesetzte Positionen, Neue kommen hinten dazu. */
export function orderAfterAssign<T extends NamedElement>(
	current: readonly T[],
	newcomers: readonly T[],
	hadStoredOrder: boolean
): T[] {
	const existing = new Set(current.map((item) => item.id));
	const added = newcomers.filter((item) => item.id && !existing.has(item.id));
	if (!hadStoredOrder) {
		return [...current, ...added].sort(compareByElementName);
	}
	return [...current, ...[...added].sort(compareByElementName)];
}

/** Markierte Ids um eine Position schieben. Zusammenhängende Auswahl bleibt ein Block. */
export function moveSelectedIds(ids: readonly string[], selected: ReadonlySet<string>, direction: -1 | 1): string[] {
	const next = [...ids];
	if (direction < 0) {
		for (let index = 1; index < next.length; index += 1) {
			if (!selected.has(next[index]) || selected.has(next[index - 1])) {
				continue;
			}
			const current = next[index];
			next[index] = next[index - 1];
			next[index - 1] = current;
		}
		return next;
	}
	for (let index = next.length - 2; index >= 0; index -= 1) {
		if (!selected.has(next[index]) || selected.has(next[index + 1])) {
			continue;
		}
		const current = next[index];
		next[index] = next[index + 1];
		next[index + 1] = current;
	}
	return next;
}
