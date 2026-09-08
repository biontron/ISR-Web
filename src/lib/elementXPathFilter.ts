import {
	AssignableTreeElement,
	collectUnassignedElements,
	readXPathExpression,
} from "./elementAssignments";
import type { IRootStore } from "../Stores/Root.Store";

type FilterDefinition = {
	storeType?: string;
	baseType?: string;
	type?: string;
	subType?: string;
	name?: string;
	label?: string;
	description?: string;
	tags?: Array<{ tag?: string } | string>;
};

type FilterableElement = {
	id: string;
	class?: string;
	definition?: FilterDefinition;
	ownerIdRef?: string | null;
	parentIdRef?: string | null;
	docks?: unknown;
	settings?: unknown;
};

type FilterXmlOptions = {
	includeDocks?: boolean;
};

const XML_NAME = /^[A-Za-z_][\w.-]*$/;

function unwrapFilterValue(value: unknown): unknown {
	if (value == null || typeof value !== "object") {
		return value;
	}
	const record = value as { toJSON?: () => unknown };
	if (typeof record.toJSON === "function") {
		try {
			return record.toJSON();
		} catch {
			return value;
		}
	}
	return value;
}

function valueToXml(name: string, value: unknown): string {
	if (!XML_NAME.test(name)) {
		return "";
	}
	const plain = unwrapFilterValue(value);
	if (plain == null || plain === "") {
		return `<${name}/>`;
	}
	if (Array.isArray(plain)) {
		return plain.map((item) => valueToXml(name, item)).join("");
	}
	if (typeof plain === "object") {
		const children = Object.entries(plain as Record<string, unknown>)
			.map(([key, child]) => valueToXml(key, child))
			.join("");
		return `<${name}>${children}</${name}>`;
	}
	return xmlLeaf(name, plain);
}

export function xpathNeedsDocks(expression: string): boolean {
	return /(^|[^A-Za-z_])docks([\s/\[\]]|$)/.test(expression);
}

function escapeXml(value: unknown): string {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function xmlLeaf(name: string, value: unknown): string {
	if (value == null || value === "") {
		return `<${name}/>`;
	}
	return `<${name}>${escapeXml(value)}</${name}>`;
}

function tagsToXml(tags: FilterDefinition["tags"]): string {
	if (!tags || tags.length === 0) {
		return "<tags/>";
	}
	const items = tags
		.map((entry) => {
			const tag = typeof entry === "string" ? entry : entry?.tag;
			return tag ? `<tag>${escapeXml(tag)}</tag>` : "";
		})
		.filter(Boolean)
		.join("");
	return items ? `<tags>${items}</tags>` : "<tags/>";
}

export function elementToFilterXml(
	element: FilterableElement,
	options: FilterXmlOptions = {}
): string {
	const definition = element.definition ?? {};
	const parentRef =
		element.class === "Group" ? element.parentIdRef : element.ownerIdRef;
	const parts = [
		"<element>",
		xmlLeaf("id", element.id),
		"<definition>",
		xmlLeaf("storeType", definition.storeType),
		xmlLeaf("baseType", definition.baseType),
		xmlLeaf("type", definition.type),
		xmlLeaf("subType", definition.subType),
		xmlLeaf("name", definition.name),
		xmlLeaf("label", definition.label),
		xmlLeaf("description", definition.description),
		tagsToXml(definition.tags),
		"</definition>",
		xmlLeaf(element.class === "Group" ? "parentIdRef" : "ownerIdRef", parentRef),
	];
	if (options.includeDocks && element.docks != null) {
		parts.push(valueToXml("docks", element.docks));
	}
	parts.push("</element>");
	return parts.join("");
}

function parseFilterDocument(
	element: FilterableElement,
	options: FilterXmlOptions
): Document | null {
	const xml = elementToFilterXml(element, options);
	const doc = new DOMParser().parseFromString(xml, "application/xml");
	if (doc.querySelector("parsererror")) {
		return null;
	}
	return doc;
}

function xpathResultIsMatch(result: XPathResult): boolean {
	switch (result.resultType) {
		case XPathResult.BOOLEAN_TYPE:
			return result.booleanValue;
		case XPathResult.NUMBER_TYPE:
			return result.numberValue !== 0 && !Number.isNaN(result.numberValue);
		case XPathResult.STRING_TYPE:
			return result.stringValue.trim() !== "";
		case XPathResult.UNORDERED_NODE_ITERATOR_TYPE:
		case XPathResult.ORDERED_NODE_ITERATOR_TYPE:
			return result.iterateNext() != null;
		case XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE:
		case XPathResult.ORDERED_NODE_SNAPSHOT_TYPE:
			return result.snapshotLength > 0;
		case XPathResult.ANY_UNORDERED_NODE_TYPE:
		case XPathResult.FIRST_ORDERED_NODE_TYPE:
			return result.singleNodeValue != null;
		default:
			return false;
	}
}

function unescapeXPathString(literal: string): string | null {
	const trimmed = literal.trim();
	if (trimmed.length < 2) {
		return null;
	}
	const quote = trimmed[0];
	if ((quote !== "'" && quote !== '"') || trimmed[trimmed.length - 1] !== quote) {
		return null;
	}
	return trimmed.slice(1, -1).split(quote + quote).join(quote);
}

function parseCallArgs(
	source: string,
	openParenIndex: number
): { args: string[]; end: number } | null {
	let depth = 1;
	let quote: "'" | '"' | null = null;
	let current = "";
	const args: string[] = [];

	for (let index = openParenIndex + 1; index < source.length; index++) {
		const char = source[index];
		if (quote) {
			current += char;
			if (char === quote) {
				if (source[index + 1] === quote) {
					current += source[index + 1];
					index += 1;
				} else {
					quote = null;
				}
			}
			continue;
		}
		if (char === "'" || char === '"') {
			quote = char;
			current += char;
			continue;
		}
		if (char === "(") {
			depth += 1;
			current += char;
			continue;
		}
		if (char === ")") {
			depth -= 1;
			if (depth === 0) {
				args.push(current.trim());
				return { args, end: index + 1 };
			}
			current += char;
			continue;
		}
		if (char === "," && depth === 1) {
			args.push(current.trim());
			current = "";
			continue;
		}
		current += char;
	}
	return null;
}

function findLastMatchCall(
	expression: string
): { start: number; end: number; args: string[] } | null {
	const matcher = /(?:fn:)?match(?:es)?\s*\(/gi;
	let last: { start: number; end: number; args: string[] } | null = null;
	let found: RegExpExecArray | null;

	while ((found = matcher.exec(expression)) != null) {
		if (found.index > 0 && /[A-Za-z0-9:_-]/.test(expression[found.index - 1])) {
			continue;
		}
		const openParen = found.index + found[0].length - 1;
		const parsed = parseCallArgs(expression, openParen);
		if (!parsed) {
			continue;
		}
		last = { start: found.index, end: parsed.end, args: parsed.args };
		matcher.lastIndex = openParen + 1;
	}
	return last;
}

function xpathPathValues(doc: Document, path: string): string[] {
	try {
		const nodes = doc.evaluate(
			path,
			doc.documentElement,
			null,
			XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
			null
		);
		if (nodes.snapshotLength > 0) {
			const values: string[] = [];
			for (let index = 0; index < nodes.snapshotLength; index++) {
				values.push(nodes.snapshotItem(index)?.textContent ?? "");
			}
			return values;
		}
	} catch {
		// Der erste Parameter kann ein String-Ausdruck sein, kein Node-Set.
	}
	try {
		return [
			doc.evaluate(
				path,
				doc.documentElement,
				null,
				XPathResult.STRING_TYPE,
				null
			).stringValue,
		];
	} catch {
		return [];
	}
}

function xpathRegexTest(value: string, pattern: string, flags: string): boolean {
	const jsFlags = flags.replace(/[^ims]/g, "");
	return new RegExp(pattern, jsFlags).test(value);
}

function readFilterPathValues(element: FilterableElement, path: string): string[] | null {
	const normalized = path.replace(/^\.\//, "").replace(/^element\//, "").trim();
	if (!normalized || /(^|\/)docks(\/|$)/.test(normalized)) {
		return null;
	}

	const definition = element.definition ?? {};
	switch (normalized) {
		case "id":
			return [element.id];
		case "ownerIdRef":
			return [String(element.ownerIdRef ?? "")];
		case "parentIdRef":
			return [String(element.parentIdRef ?? "")];
		case "definition/storeType":
			return [String(definition.storeType ?? "")];
		case "definition/baseType":
			return [String(definition.baseType ?? "")];
		case "definition/type":
			return [String(definition.type ?? "")];
		case "definition/subType":
			return [String(definition.subType ?? "")];
		case "definition/name":
			return [String(definition.name ?? "")];
		case "definition/label":
			return [String(definition.label ?? "")];
		case "definition/description":
			return [String(definition.description ?? "")];
		case "definition/tags/tag":
		case "definition/tags":
			return (definition.tags ?? [])
				.map((entry) => (typeof entry === "string" ? entry : entry?.tag ?? ""))
				.filter((tag) => tag !== "");
		default:
			return null;
	}
}

function splitTopLevel(expression: string, separator: " and " | " or "): string[] {
	const parts: string[] = [];
	let depth = 0;
	let quote: "'" | '"' | null = null;
	let start = 0;
	const sep = separator;

	for (let index = 0; index < expression.length; index++) {
		const char = expression[index];
		if (quote) {
			if (char === quote) {
				quote = null;
			}
			continue;
		}
		if (char === "'" || char === '"') {
			quote = char;
			continue;
		}
		if (char === "(") {
			depth += 1;
			continue;
		}
		if (char === ")") {
			depth = Math.max(0, depth - 1);
			continue;
		}
		if (depth === 0 && expression.slice(index, index + sep.length).toLowerCase() === sep) {
			parts.push(expression.slice(start, index).trim());
			index += sep.length - 1;
			start = index + 1;
		}
	}
	parts.push(expression.slice(start).trim());
	return parts.filter(Boolean);
}

function unwrapElementPredicate(expression: string): string {
	const trimmed = expression.trim();
	const wrapped = trimmed.match(/^\/\/(?:element|\*)\s*\[(.*)\]$/s);
	return wrapped ? wrapped[1].trim() : trimmed;
}

function parseStringLiteral(source: string): string | null {
	return unescapeXPathString(source.trim());
}

function evaluateFastPredicate(element: FilterableElement, expression: string): boolean | null {
	const expr = unwrapElementPredicate(expression);
	if (!expr) {
		return false;
	}

	const orParts = splitTopLevel(expr, " or ");
	if (orParts.length > 1) {
		let sawNull = false;
		for (const part of orParts) {
			const result = evaluateFastPredicate(element, part);
			if (result === true) {
				return true;
			}
			if (result === null) {
				sawNull = true;
			}
		}
		return sawNull ? null : false;
	}

	const andParts = splitTopLevel(expr, " and ");
	if (andParts.length > 1) {
		for (const part of andParts) {
			const result = evaluateFastPredicate(element, part);
			if (result === null) {
				return null;
			}
			if (!result) {
				return false;
			}
		}
		return true;
	}

	const notMatch = expr.match(/^not\s*\((.*)\)\s*$/is);
	if (notMatch) {
		const inner = evaluateFastPredicate(element, notMatch[1]);
		return inner === null ? null : !inner;
	}

	if (/^true\s*\(\s*\)$/i.test(expr)) {
		return true;
	}
	if (/^false\s*\(\s*\)$/i.test(expr)) {
		return false;
	}

	const startsWith = expr.match(/^starts-with\s*\(\s*(.+?)\s*,\s*(.+)\s*\)$/is);
	if (startsWith) {
		const values = readFilterPathValues(element, startsWith[1]);
		const prefix = parseStringLiteral(startsWith[2]);
		if (!values || prefix == null) {
			return null;
		}
		return values.some((value) => value.startsWith(prefix));
	}

	const matchCall = findLastMatchCall(expr);
	if (matchCall && matchCall.start === 0 && matchCall.end === expr.length) {
		const values = readFilterPathValues(element, matchCall.args[0] ?? "");
		const pattern = parseStringLiteral(matchCall.args[1] ?? "");
		const flags = matchCall.args[2] ? parseStringLiteral(matchCall.args[2]) ?? "" : "";
		if (!values || pattern == null) {
			return null;
		}
		return values.some((value) => xpathRegexTest(value, pattern, flags));
	}

	const equality = expr.match(/^(.+?)\s*=\s*(.+)$/s);
	if (equality) {
		const values = readFilterPathValues(element, equality[1]);
		const expected = parseStringLiteral(equality[2]);
		if (!values || expected == null) {
			return null;
		}
		return values.some((value) => value === expected);
	}

	return null;
}

/** Ohne DOMParser — für definition/id-Pfade. null = Fallback auf Browser-XPath. */
export function tryFastXPathMatch(element: FilterableElement, expression: string): boolean | null {
	const xpath = expression.trim();
	if (!xpath) {
		return false;
	}
	try {
		return evaluateFastPredicate(element, xpath);
	} catch {
		return null;
	}
}

function filterElementFingerprint(element: FilterableElement, includeDocks: boolean): string {
	const definition = element.definition ?? {};
	const tags = (definition.tags ?? [])
		.map((entry) => (typeof entry === "string" ? entry : entry?.tag ?? ""))
		.join(",");
	const parts = [
		element.id,
		element.class ?? "",
		String(element.ownerIdRef ?? ""),
		String(element.parentIdRef ?? ""),
		definition.storeType ?? "",
		definition.baseType ?? "",
		definition.type ?? "",
		definition.subType ?? "",
		definition.name ?? "",
		definition.label ?? "",
		definition.description ?? "",
		tags,
	];
	if (includeDocks && element.docks != null) {
		try {
			parts.push(JSON.stringify(unwrapFilterValue(element.docks)));
		} catch {
			parts.push("docks");
		}
	}
	return parts.join("\0");
}

const xpathMatchCache = new Map<string, { fingerprint: string; matched: boolean }>();
const XPATH_MATCH_CACHE_MAX = 8000;

function readCachedXPathMatch(cacheKey: string, fingerprint: string): boolean | undefined {
	const hit = xpathMatchCache.get(cacheKey);
	if (hit && hit.fingerprint === fingerprint) {
		return hit.matched;
	}
	return undefined;
}

function writeCachedXPathMatch(cacheKey: string, fingerprint: string, matched: boolean): void {
	if (xpathMatchCache.size >= XPATH_MATCH_CACHE_MAX) {
		xpathMatchCache.clear();
	}
	xpathMatchCache.set(cacheKey, { fingerprint, matched });
}

function matchElementAgainstExpressions(
	element: FilterableElement,
	expressions: string[]
): boolean {
	if (expressions.length === 0) {
		return false;
	}

	const includeDocks = expressions.some(xpathNeedsDocks);
	const fingerprint = filterElementFingerprint(element, includeDocks);
	const cacheKey = `${element.id}\0${includeDocks ? "1" : "0"}\0${expressions.join("\n")}`;
	const cached = readCachedXPathMatch(cacheKey, fingerprint);
	if (cached !== undefined) {
		return cached;
	}

	const pending: string[] = [];
	for (const xpath of expressions) {
		const fast = tryFastXPathMatch(element, xpath);
		if (fast === true) {
			writeCachedXPathMatch(cacheKey, fingerprint, true);
			return true;
		}
		if (fast === null) {
			pending.push(xpath);
		}
	}

	if (pending.length === 0) {
		writeCachedXPathMatch(cacheKey, fingerprint, false);
		return false;
	}

	const doc = parseFilterDocument(element, { includeDocks: pending.some(xpathNeedsDocks) });
	const matched = !!doc && pending.some((xpath) => elementMatchesXPathOnDocument(doc, xpath));
	writeCachedXPathMatch(cacheKey, fingerprint, matched);
	return matched;
}

/** Browser-XPath 1.0 kennt match()/matches() nicht — vorab in true()/false() auflösen. */
export function rewriteXPathMatchFunctions(expression: string, doc: Document): string {
	let current = expression;
	for (let guard = 0; guard < 32; guard++) {
		const call = findLastMatchCall(current);
		if (!call) {
			return current;
		}
		const path = call.args[0] ?? "";
		const pattern = unescapeXPathString(call.args[1] ?? "");
		const flags = call.args[2] ? unescapeXPathString(call.args[2]) ?? "" : "";
		let matched = false;
		if (path && pattern != null) {
			try {
				matched = xpathPathValues(doc, path).some((value) =>
					xpathRegexTest(value, pattern, flags)
				);
			} catch {
				matched = false;
			}
		}
		current =
			current.slice(0, call.start) +
			(matched ? "true()" : "false()") +
			current.slice(call.end);
	}
	return current;
}

export function elementMatchesXPathOnDocument(doc: Document, expression: string): boolean {
	const xpath = expression.trim();
	if (!xpath) {
		return false;
	}

	try {
		const rewritten = rewriteXPathMatchFunctions(xpath, doc);
		const result = doc.evaluate(
			rewritten,
			doc.documentElement,
			null,
			XPathResult.ANY_TYPE,
			null
		);
		return xpathResultIsMatch(result);
	} catch {
		return false;
	}
}

export function elementMatchesXPath(element: FilterableElement, expression: string): boolean {
	const xpath = expression.trim();
	if (!xpath) {
		return false;
	}
	return matchElementAgainstExpressions(element, [xpath]);
}

export function elementMatchesAnyXPath(
	element: FilterableElement,
	rules: unknown[]
): boolean {
	const expressions = rules.map(readXPathExpression).filter(Boolean);
	return matchElementAgainstExpressions(element, expressions);
}

function partitionUnassignedByXPath(
	unassigned: AssignableTreeElement[],
	rules: unknown[]
): { matched: AssignableTreeElement[]; available: AssignableTreeElement[] } {
	const expressions = rules.map(readXPathExpression).filter(Boolean);
	if (expressions.length === 0) {
		return { matched: [], available: unassigned };
	}

	const matched: AssignableTreeElement[] = [];
	const available: AssignableTreeElement[] = [];

	for (const element of unassigned) {
		if (matchElementAgainstExpressions(element, expressions)) {
			matched.push(element);
		} else {
			available.push(element);
		}
	}

	return { matched, available };
}

export function collectFilterElementPartition(
	root: Pick<IRootStore, "groups" | "assets">,
	parentId: string,
	rules: unknown[]
): { matched: AssignableTreeElement[]; available: AssignableTreeElement[] } {
	const expressions = rules.map(readXPathExpression).filter(Boolean);
	const unassigned = collectUnassignedElements(root, parentId);
	if (expressions.length === 0) {
		return { matched: [], available: unassigned };
	}
	return partitionUnassignedByXPath(unassigned, rules);
}

export function collectFilterMatchedElements(
	root: Pick<IRootStore, "groups" | "assets">,
	parentId: string,
	rules: unknown[]
): AssignableTreeElement[] {
	if (rules.map(readXPathExpression).every((xpath) => xpath === "")) {
		return [];
	}
	return collectFilterElementPartition(root, parentId, rules).matched;
}

export function collectFilterAvailableElements(
	root: Pick<IRootStore, "groups" | "assets">,
	parentId: string,
	rules: unknown[]
): AssignableTreeElement[] {
	return collectFilterElementPartition(root, parentId, rules).available;
}

/** XPath-Treffer, die noch nicht als statische Kinder im Tree stehen — Parent-Refs bleiben unverändert. */
export function collectFilterMatchedElementsExcluding(
	root: Pick<IRootStore, "groups" | "assets">,
	parentId: string,
	rules: unknown[],
	excludeIds: Iterable<string>
): AssignableTreeElement[] {
	const skip = new Set(excludeIds);
	return collectFilterMatchedElements(root, parentId, rules).filter(
		(element) => !skip.has(element.id)
	);
}
