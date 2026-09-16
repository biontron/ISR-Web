import type { IAsset } from "../Stores/Models/Asset.Model";
import type { IConnection } from "../Stores/Models/Connection.Model";
import type {
	ValidationRuleRecord,
	ValidationRuleType,
} from "../Stores/Models/ValidationRule.Model";
import {
	addXPathRule,
	readXPathRuleType,
	removeXPathRule,
	snapshotXPathRules,
	toXPathRuleRecord,
	updateXPathRule,
} from "./xpathRule";
import type { IView } from "../Stores/Models/View.Model";
import type { IRootStore } from "../Stores/Root.Store";
import { findAssetByEndpointRef } from "./connectionEndpointRef";
import {
	collectXPathMatchFieldPaths,
	elementMatchesXPath,
	isUsableXPathExpression,
	type FilterableElement,
} from "./elementXPathFilter";
import { elementStatusShowsIndicator } from "./elementStatusStyle";

export type { ValidationRuleRecord, ValidationRuleType };

export type SearchableElement = FilterableElement & {
	status?: string;
};

export type ElementMarkFlags = {
	changed: boolean;
	positive: boolean;
	negative: boolean;
	searchMatch: boolean;
	fieldPaths: string[];
};

export type ViewSearchHit = {
	id: string;
	class: string;
	title: string;
	description: string;
	status?: string;
	positive: boolean;
	negative: boolean;
	searchMatch: boolean;
};

const XPATH_HINT =
	/\/\/|\/|\[|\]|(?:fn:)?match(?:es)?\s*\(|starts-with\s*\(|contains\s*\(|equals\s*\(|(?:=|!=)/;

const SEARCH_HIT_LIMIT = 200;

function emptyMarks(changed: boolean): ElementMarkFlags {
	return {
		changed,
		positive: false,
		negative: false,
		searchMatch: false,
		fieldPaths: [],
	};
}

function ensureMarks(
	map: Map<string, ElementMarkFlags>,
	id: string,
	changed: boolean
): ElementMarkFlags {
	const existing = map.get(id);
	if (existing) {
		return existing;
	}
	const created = emptyMarks(changed);
	map.set(id, created);
	return created;
}

function addFieldPaths(marks: ElementMarkFlags, paths: string[]): void {
	if (paths.length === 0) {
		return;
	}
	const next = new Set(marks.fieldPaths);
	for (const path of paths) {
		if (path) {
			next.add(path);
		}
	}
	marks.fieldPaths = Array.from(next);
}

export function readValidationRuleType(value: string): ValidationRuleType | undefined {
	return value === "positive" || value === "negative" ? value : undefined;
}

export function snapshotValidationRules(
	rules: ReadonlyArray<{ xpath: string; comment: string; type: string }>
): ValidationRuleRecord[] {
	return snapshotXPathRules(rules, ["positive", "negative"]) as ValidationRuleRecord[];
}

export function looksLikeXPath(query: string): boolean {
	return XPATH_HINT.test(query.trim());
}

export function resolveSearchMode(query: string): "xpath" | "freetext" {
	const trimmed = query.trim();
	if (!trimmed) {
		return "freetext";
	}
	if (looksLikeXPath(trimmed) && isUsableXPathExpression(trimmed)) {
		return "xpath";
	}
	return "freetext";
}

function definitionHaystack(element: SearchableElement): string {
	const definition = element.definition ?? {};
	const tags = (definition.tags ?? [])
		.map((entry) => (typeof entry === "string" ? entry : entry?.tag ?? ""))
		.join(" ");
	return [
		element.id,
		element.class ?? "",
		definition.storeType,
		definition.baseType,
		definition.type,
		definition.subType,
		definition.name,
		definition.label,
		definition.description,
		tags,
	]
		.filter((value) => value != null && value !== "")
		.join(" ")
		.toLowerCase();
}

function connectionHaystack(connection: IConnection): string {
	const linkText = connection.links
		.map((link) =>
			[link.title, link.fromLabelSnapshot, link.toLabelSnapshot, link.id].filter(Boolean).join(" ")
		)
		.join(" ");
	return [
		connection.id,
		connection.definition?.label,
		connection.definition?.description,
		linkText,
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
}

export function elementMatchesFreetext(element: SearchableElement, query: string): boolean {
	const search = query.trim().toLowerCase();
	if (!search) {
		return false;
	}
	if (element.class === "Connection") {
		return connectionHaystack(element as IConnection).includes(search);
	}
	return definitionHaystack(element).includes(search);
}

function walkViewChildren(node: { id?: string; class?: string; children?: () => unknown[] }, seen: Set<string>, out: SearchableElement[]) {
	if (!node?.id || seen.has(node.id)) {
		return;
	}
	seen.add(node.id);
	if (node.class === "Group" || node.class === "Asset" || node.class === "View") {
		out.push(node as SearchableElement);
	}
	if (typeof node.children !== "function") {
		return;
	}
	for (const child of node.children()) {
		if (child && typeof child === "object") {
			walkViewChildren(child as { id?: string; class?: string; children?: () => unknown[] }, seen, out);
		}
	}
}

export function collectViewScopedElements(view: IView | null | undefined): SearchableElement[] {
	if (!view || typeof view.children !== "function") {
		return [];
	}
	const out: SearchableElement[] = [];
	const seen = new Set<string>();
	walkViewChildren(view, seen, out);
	return out;
}

function collectOtherViews(
	root: Pick<IRootStore, "views">,
	excludeId: string | undefined
): SearchableElement[] {
	const views = root.views?.views ?? [];
	return views.filter((entry) => entry.id !== excludeId);
}

function resolveLinkEndpointId(
	assets: IAsset[],
	link: IConnection["links"][number],
	side: "from" | "to"
): string | null {
	const componentRef = side === "from" ? link.fromComponentRef : link.toComponentRef;
	const trimmed = componentRef?.trim();
	if (trimmed) {
		return trimmed;
	}
	const dockRef = (side === "from" ? link.fromDockRef : link.toDockRef)?.trim();
	if (!dockRef) {
		return null;
	}
	return findAssetByEndpointRef(assets, dockRef)?.id ?? null;
}

export function collectViewScopedConnections(
	root: Pick<IRootStore, "assets" | "connections">,
	visibleIds: Set<string>
): IConnection[] {
	const assets = root.assets?.assets ?? [];
	const connections = root.connections?.connections ?? [];
	if (visibleIds.size === 0) {
		return [];
	}
	return connections.filter((connection) =>
		connection.links.some((link) => {
			const fromId = resolveLinkEndpointId(assets, link, "from");
			const toId = resolveLinkEndpointId(assets, link, "to");
			return (fromId != null && visibleIds.has(fromId)) || (toId != null && visibleIds.has(toId));
		})
	);
}

function connectionDisplayTitle(connection: IConnection): string {
	const label = connection.definition?.label?.trim();
	if (label) {
		return label;
	}
	const linkTitle = connection.links[0]?.title?.trim();
	if (linkTitle) {
		return linkTitle;
	}
	return connection.id;
}

function displayTitle(element: SearchableElement): string {
	if (element.class === "Connection") {
		return connectionDisplayTitle(element as IConnection);
	}
	return element.definition?.name?.trim() || element.id;
}

function displayDescription(element: SearchableElement): string {
	if (element.class === "Connection") {
		return (element as IConnection).definition?.description ?? "";
	}
	return element.definition?.description ?? "";
}

function applyXPathRule(
	marks: Map<string, ElementMarkFlags>,
	element: SearchableElement,
	xpath: string,
	type?: ValidationRuleType
): boolean {
	if (!elementMatchesXPath(element, xpath)) {
		return false;
	}
	const entry = ensureMarks(marks, element.id, elementStatusShowsIndicator(element.status as never));
	if (type === "positive") {
		entry.positive = true;
	} else if (type === "negative") {
		entry.negative = true;
	} else {
		entry.searchMatch = true;
	}
	addFieldPaths(entry, collectXPathMatchFieldPaths(element, xpath));
	return true;
}

export type ValidationMarkOptions = {
	applyPositive?: boolean;
	applyNegative?: boolean;
};

export function collectViewElementMarks(
	root: Pick<IRootStore, "assets" | "connections" | "views">,
	view: IView | null | undefined,
	searchText: string,
	options?: ValidationMarkOptions
): Map<string, ElementMarkFlags> {
	const marks = new Map<string, ElementMarkFlags>();
	const elements = collectViewScopedElements(view);
	const visibleIds = new Set(elements.map((element) => element.id));
	const connections = collectViewScopedConnections(root, visibleIds);
	const candidates: SearchableElement[] = [...elements, ...connections];
	const searchCandidates: SearchableElement[] = [
		...candidates,
		...collectOtherViews(root, view?.id),
	];

	for (const element of searchCandidates) {
		ensureMarks(marks, element.id, elementStatusShowsIndicator(element.status as never));
	}

	const applyPositive = options?.applyPositive === true;
	const applyNegative = options?.applyNegative === true;
	const rules = view?.validationRules ?? [];
	for (const rule of rules) {
		const xpath = rule.xpath?.trim() ?? "";
		if (!xpath) {
			continue;
		}
		const type = readXPathRuleType(rule);
		if (type === "positive" && !applyPositive) {
			continue;
		}
		if (type === "negative" && !applyNegative) {
			continue;
		}
		if (type !== "positive" && type !== "negative") {
			continue;
		}
		for (const element of candidates) {
			applyXPathRule(marks, element, xpath, type);
		}
	}

	const query = searchText.trim();
	if (query) {
		const mode = resolveSearchMode(query);
		for (const element of searchCandidates) {
			const matched =
				mode === "xpath"
					? applyXPathRule(marks, element, query)
					: elementMatchesFreetext(element, query);
			if (matched) {
				const entry = ensureMarks(
					marks,
					element.id,
					elementStatusShowsIndicator(element.status as never)
				);
				entry.searchMatch = true;
			}
		}
	}

	return marks;
}

export function collectViewSearchHits(
	root: Pick<IRootStore, "assets" | "connections" | "views">,
	view: IView | null | undefined,
	searchText: string,
	marks?: Map<string, ElementMarkFlags>,
	options?: ValidationMarkOptions
): ViewSearchHit[] {
	const query = searchText.trim();
	if (!query) {
		return [];
	}
	const resolved = marks ?? collectViewElementMarks(root, view, searchText, options);
	const elements = collectViewScopedElements(view);
	const visibleIds = new Set(elements.map((element) => element.id));
	const connections = collectViewScopedConnections(root, visibleIds);
	const extras = collectOtherViews(root, view?.id);
	const hits: ViewSearchHit[] = [];
	for (const element of [...elements, ...connections, ...extras]) {
		const entry = resolved.get(element.id);
		if (!entry?.searchMatch) {
			continue;
		}
		hits.push({
			id: element.id,
			class: element.class ?? "",
			title: displayTitle(element),
			description: displayDescription(element),
			status: element.status,
			positive: entry.positive,
			negative: entry.negative,
			searchMatch: true,
		});
		if (hits.length >= SEARCH_HIT_LIMIT) {
			break;
		}
	}
	return hits;
}

export function fieldPathHasMark(fieldPath: string, markedPaths: string[]): boolean {
	if (!fieldPath) {
		return false;
	}
	return markedPaths.some((marked) => {
		if (!marked) {
			return false;
		}
		return (
			fieldPath === marked ||
			fieldPath.startsWith(`${marked}.`) ||
			marked.startsWith(`${fieldPath}.`)
		);
	});
}

function escapeXPathLiteral(value: string): string {
	if (!value.includes("'")) {
		return `'${value}'`;
	}
	if (!value.includes('"')) {
		return `"${value}"`;
	}
	const parts = value.split("'").map((part) => `'${part}'`);
	return `concat(${parts.join(", \"'\", ")})`;
}

export function freetextToValidationXPath(query: string): string {
	const literal = escapeXPathLiteral(query.trim());
	return [
		`contains(id,${literal})`,
		`contains(definition/name,${literal})`,
		`contains(definition/label,${literal})`,
		`contains(definition/description,${literal})`,
	].join(" or ");
}

export function toValidationRuleRecord(
	xpath: string,
	comment: string,
	type: ValidationRuleType
): ValidationRuleRecord {
	return toXPathRuleRecord(xpath, comment, type) as ValidationRuleRecord;
}

export function addValidationRule(
	rules: ValidationRuleRecord[],
	xpath: string,
	comment: string,
	type: ValidationRuleType
): ValidationRuleRecord[] {
	return addXPathRule(rules, xpath, comment, type) as ValidationRuleRecord[];
}

export function updateValidationRule(
	rules: ValidationRuleRecord[],
	index: number,
	patch: Partial<ValidationRuleRecord>
): ValidationRuleRecord[] {
	return updateXPathRule(rules, index, patch) as ValidationRuleRecord[];
}

export function removeValidationRule(
	rules: ValidationRuleRecord[],
	index: number
): ValidationRuleRecord[] {
	return removeXPathRule(rules, index) as ValidationRuleRecord[];
}

export function searchQueryToValidationXPath(query: string): string {
	const trimmed = query.trim();
	if (!trimmed) {
		return "";
	}
	if (resolveSearchMode(trimmed) === "xpath") {
		return trimmed;
	}
	return freetextToValidationXPath(trimmed);
}
