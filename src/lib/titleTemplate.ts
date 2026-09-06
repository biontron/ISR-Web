function readPath(data: unknown, path: string): unknown {
	if (data == null || typeof data !== "object") {
		return undefined;
	}
	let current: unknown = data;
	for (const segment of path.split(".")) {
		if (current == null || typeof current !== "object") {
			return undefined;
		}
		current = (current as Record<string, unknown>)[segment];
	}
	return current;
}

function formatTemplateValue(value: unknown): string {
	if (value == null) {
		return "";
	}
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (Array.isArray(value)) {
		return value.map((entry) => formatTemplateValue(entry)).filter(Boolean).join(", ");
	}
	return "";
}

/** Ersetzt {field} und #{field} in titleTemplate aus dem aktuellen Datenobjekt. */
export function interpolateTitleTemplate(
	template: string | undefined,
	data: unknown,
	fallback: string
): string {
	const source = String(template ?? "").trim();
	if (!source) {
		return fallback;
	}
	const replaced = source
		.replace(/#\{([^}]+)\}/g, (_match, path: string) =>
			`#${formatTemplateValue(readPath(data, path.trim()))}`
		)
		.replace(/\{([^}]+)\}/g, (_match, path: string) =>
			formatTemplateValue(readPath(data, path.trim()))
		)
		.replace(/\s+/g, " ")
		.trim();
	return replaced || fallback;
}
