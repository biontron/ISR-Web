import { getValueByPath } from "./path";

export type TitleTemplateContext = {
	/** Elementwurzel — für `$…` / `/…` und relative Pfade über `basePath`. */
	root?: unknown;
	/** MST-Pfad des aktuellen Knotens, z. B. `docks[0].dockparts[2].settings`. */
	basePath?: string;
};

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

function tidyInterpolatedTitle(value: string): string {
	return value
		.replace(/\s+/g, " ")
		.replace(/\/{2,}/g, "/")
		.replace(/\s+\/\s+-\s+/g, " - ")
		.replace(/^\/+|\/+$/g, "")
		.replace(/\s*->\s*$/g, "")
		.replace(/^\s*->\s*/, "")
		.replace(/\s*:\s*$/g, "")
		.replace(/^\s*:\s*/, "")
		.trim();
}

function joinMstPath(segments: string[]): string {
	let result = "";
	for (const segment of segments) {
		if (/^\d+$/.test(segment)) {
			result += `[${segment}]`;
		} else {
			result = result ? `${result}.${segment}` : segment;
		}
	}
	return result;
}

function splitMstPath(path: string): string[] {
	return path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
}

export function parentMstPath(path: string): string {
	const segments = splitMstPath(path);
	if (segments.length === 0) {
		return "";
	}
	segments.pop();
	return joinMstPath(segments);
}

function expandPathSegment(segment: string): string[] {
	const match = segment.match(/^([^\[]*)\[(\d+)\]$/);
	if (!match) {
		return segment ? [segment] : [];
	}
	return [match[1], match[2]].filter(Boolean);
}

function parseTemplatePath(expression: string): { absolute: boolean; segments: string[] } {
	let source = expression.trim();
	let absolute = false;
	if (source.startsWith("$.")) {
		absolute = true;
		source = source.slice(2);
	} else if (source.startsWith("$")) {
		absolute = true;
		source = source.slice(1);
	} else if (source.startsWith("/")) {
		absolute = true;
		source = source.slice(1);
	}

	const raw = source.includes("/")
		? source.split("/")
		: splitMstPath(source);
	const segments = raw.flatMap(expandPathSegment).filter((segment) => segment && segment !== ".");
	return { absolute, segments };
}

function valueBySegments(root: unknown, startPath: string, segments: string[]): unknown {
	if (root == null) {
		return undefined;
	}
	const resolved = startPath ? splitMstPath(startPath) : [];
	for (const segment of segments) {
		if (segment === "..") {
			resolved.pop();
			continue;
		}
		resolved.push(segment);
	}
	const path = joinMstPath(resolved);
	return path ? getValueByPath(root, path) : root;
}

function resolveTemplatePath(
	expression: string,
	data: unknown,
	context?: TitleTemplateContext
): unknown {
	const { absolute, segments } = parseTemplatePath(expression);
	if (segments.length === 0) {
		return undefined;
	}

	const variants =
		segments[segments.length - 1] === "title"
			? [segments, [...segments.slice(0, -1), "label"]]
			: [segments];

	for (const candidate of variants) {
		const resolved = resolveTemplateSegments(candidate, data, context, absolute);
		if (resolved !== undefined) {
			return resolved;
		}
	}
	return undefined;
}

function resolveTemplateSegments(
	segments: string[],
	data: unknown,
	context: TitleTemplateContext | undefined,
	absolute: boolean
): unknown {
	if (absolute) {
		return valueBySegments(context?.root, "", segments);
	}

	const hasParentStep = segments.includes("..");
	if (!hasParentStep && data != null) {
		const fromData = getValueByPath(data, joinMstPath(segments));
		if (fromData !== undefined) {
			return fromData;
		}
	}

	const root = context?.root;
	const basePath = context?.basePath ?? "";
	if (root != null && basePath) {
		const fromHere = valueBySegments(root, basePath, segments);
		if (fromHere !== undefined) {
			return fromHere;
		}
		const fromParent = valueBySegments(root, parentMstPath(basePath), segments);
		if (fromParent !== undefined) {
			return fromParent;
		}
	}

	return undefined;
}

/** Ersetzt {pfad} und #{pfad} — JSON-Path (`settings.ip`, `$.id`) und XPath (`settings/ip`, `./ip`). */
export function interpolateTitleTemplate(
	template: string | undefined,
	data: unknown,
	fallback: string,
	context?: TitleTemplateContext
): string {
	const source = String(template ?? "").trim();
	if (!source) {
		return fallback;
	}
	let hadValue = false;
	const replaced = source
		.replace(/#\{([^}]+)\}/g, (_match, path: string) => {
			const formatted = formatTemplateValue(resolveTemplatePath(path, data, context));
			if (formatted) {
				hadValue = true;
			}
			return `#${formatted}`;
		})
		.replace(/\{([^}]+)\}/g, (_match, path: string) => {
			const formatted = formatTemplateValue(resolveTemplatePath(path, data, context));
			if (formatted) {
				hadValue = true;
			}
			return formatted;
		});
	if (!hadValue) {
		return fallback;
	}
	return tidyInterpolatedTitle(replaced) || fallback;
}
