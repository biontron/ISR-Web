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
};

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

export function elementToFilterXml(element: FilterableElement): string {
	const definition = element.definition ?? {};
	const parentRef =
		element.class === "Group" ? element.parentIdRef : element.ownerIdRef;
	return [
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
		"</element>",
	].join("");
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

export function elementMatchesXPath(element: FilterableElement, expression: string): boolean {
	const xpath = expression.trim();
	if (!xpath) {
		return false;
	}

	const xml = elementToFilterXml(element);
	const doc = new DOMParser().parseFromString(xml, "application/xml");
	if (doc.querySelector("parsererror")) {
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

export function elementMatchesAnyXPath(
	element: FilterableElement,
	rules: unknown[]
): boolean {
	const expressions = rules.map(readXPathExpression).filter(Boolean);
	if (expressions.length === 0) {
		return false;
	}
	return expressions.some((xpath) => elementMatchesXPath(element, xpath));
}

export function collectFilterMatchedElements(
	root: Pick<IRootStore, "groups" | "assets">,
	parentId: string,
	rules: unknown[]
): AssignableTreeElement[] {
	if (rules.map(readXPathExpression).every((xpath) => xpath === "")) {
		return [];
	}
	return collectUnassignedElements(root, parentId).filter((element) =>
		elementMatchesAnyXPath(element, rules)
	);
}

export function collectFilterAvailableElements(
	root: Pick<IRootStore, "groups" | "assets">,
	parentId: string,
	rules: unknown[]
): AssignableTreeElement[] {
	const matchedIds = new Set(
		collectFilterMatchedElements(root, parentId, rules).map((element) => element.id)
	);
	return collectUnassignedElements(root, parentId).filter(
		(element) => !matchedIds.has(element.id)
	);
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
