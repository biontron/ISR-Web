export type EnvironmentScoped = {
	id: string;
	environmentId?: string | null;
};

export function readEnvironmentId(element?: { environmentId?: string | null } | null): string {
	return typeof element?.environmentId === "string" ? element.environmentId.trim() : "";
}

export function findByIdInEnvironment<T extends EnvironmentScoped>(
	items: readonly T[],
	id: string,
	environmentId?: string | null
): T | undefined {
	const trimmedId = id.trim();
	if (!trimmedId) {
		return undefined;
	}
	const env = typeof environmentId === "string" ? environmentId.trim() : "";
	if (env) {
		return (
			items.find((item) => item.id === trimmedId && readEnvironmentId(item) === env) ??
			items.find((item) => item.id === trimmedId && !readEnvironmentId(item))
		);
	}
	const matches = items.filter((item) => item.id === trimmedId);
	return matches.length === 1 ? matches[0] : undefined;
}

export function stampEnvironmentId<T extends Record<string, unknown>>(
	item: T,
	environmentId: string
): T {
	if (!environmentId) {
		return item;
	}
	if (typeof item.environmentId === "string" && item.environmentId.trim()) {
		return item;
	}
	return { ...item, environmentId };
}
