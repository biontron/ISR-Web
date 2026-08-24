import {
	AssignableTreeElement,
	collectUnassignedElements,
	readXPathExpression,
} from "./elementAssignments";
import { IRootStore } from "../Stores/Root.Store";

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
		const result = doc.evaluate(
			xpath,
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
