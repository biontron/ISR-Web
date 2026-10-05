import { SchemaStoreType } from "./schemaDomain";
import { createEmptySchemaPayload } from "./schemaCreateDefaults";

export type SchemaSampleFormat = "json" | "xml" | "yaml";

export type SchemaSampleParseReason = "empty" | "json" | "xml" | "yaml" | "tabs" | "anchor";

export class SchemaSampleParseError extends Error {
	readonly reason: SchemaSampleParseReason;

	constructor(reason: SchemaSampleParseReason) {
		super(reason);
		this.name = "SchemaSampleParseError";
		this.reason = reason;
	}
}

export interface ParsedSampleDocument {
	format: SchemaSampleFormat;
	value: unknown;
	suggestedId?: string;
}

export type GeneratedFieldType = "string" | "number" | "boolean" | "null" | "object" | "array";

export interface GeneratedSchemaField {
	kind: "field";
	order: number;
	dataStructure: {
		itemName: string;
		default: string;
		nullable?: boolean;
	};
	formProperties: { label: { und: string; de: string; en: string } };
	fieldType: GeneratedFieldType;
	example?: string;
	itemFlags: { readonly: boolean; hidden: boolean; nullable: boolean };
	minUsage: number;
	maxUsage: number;
}

export interface GeneratedSchemaGroup {
	kind: "group";
	order: number;
	dataStructure: { itemName: string };
	formProperties: { label: { und: string; de: string; en: string } };
	itemFlags: { readonly: boolean; hidden: boolean };
	minUsage: number;
	maxUsage: number;
	collectionType: "array" | "map";
	items: GeneratedSchemaItem[];
}

export type GeneratedSchemaItem = GeneratedSchemaField | GeneratedSchemaGroup;

const ARRAY_MAX_USAGE = 9999;

const LANGUAGE_KEYS = new Set([
	"und",
	"intl",
	"de",
	"en",
	"fr",
	"es",
	"it",
	"pt",
	"nl",
	"pl",
	"ru",
	"zh",
	"ja",
	"ar",
	"tr",
	"sv",
	"da",
	"fi",
	"no",
	"cs",
	"hu",
	"ro",
	"uk",
	"ko",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === "object" && !Array.isArray(value);
}

function isMultilingualTextRecord(value: unknown): value is Record<string, unknown> {
	if (!isPlainObject(value)) {
		return false;
	}
	const keys = Object.keys(value);
	if (keys.length === 0) {
		return false;
	}
	return keys.every(
		(key) => LANGUAGE_KEYS.has(key) && (value[key] == null || typeof value[key] === "string")
	);
}

export function suggestSchemaId(raw: string): string {
	return raw
		.trim()
		.replace(/[^A-Za-z0-9_-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^[-_]+|[-_]+$/g, "")
		.toUpperCase();
}

function optionalSuggestedId(raw: unknown): string | undefined {
	if (typeof raw !== "string") {
		return undefined;
	}
	const suggested = suggestSchemaId(raw);
	return suggested || undefined;
}

export function detectSampleFormat(text: string): SchemaSampleFormat | null {
	const trimmed = text.replace(/^\uFEFF/, "").trim();
	if (!trimmed) {
		return null;
	}
	if (trimmed.startsWith("<")) {
		return "xml";
	}
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		return "json";
	}
	return "yaml";
}

export function parseSampleDocument(text: string): ParsedSampleDocument {
	const source = text.replace(/^\uFEFF/, "");
	const trimmed = source.trim();
	if (!trimmed) {
		throw new SchemaSampleParseError("empty");
	}
	if (trimmed.startsWith("<")) {
		return parseXmlDocument(trimmed);
	}
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		try {
			const value = JSON.parse(trimmed) as unknown;
			return {
				format: "json",
				value,
				suggestedId: suggestedIdFromObject(value),
			};
		} catch (error) {
			if (error instanceof SchemaSampleParseError) {
				throw error;
			}
			try {
				const value = parseYaml(trimmed);
				return {
					format: "yaml",
					value,
					suggestedId: suggestedIdFromObject(value),
				};
			} catch (yamlError) {
				if (yamlError instanceof SchemaSampleParseError && yamlError.reason !== "yaml") {
					throw yamlError;
				}
				throw new SchemaSampleParseError("json");
			}
		}
	}
	const value = parseYaml(source);
	return {
		format: "yaml",
		value,
		suggestedId: suggestedIdFromObject(value),
	};
}

function suggestedIdFromObject(value: unknown): string | undefined {
	if (!isPlainObject(value)) {
		return undefined;
	}
	return optionalSuggestedId(value.id);
}

export function schemaItemsFromValue(value: unknown): GeneratedSchemaItem[] {
	if (Array.isArray(value)) {
		const present = value.filter((entry) => entry != null);
		const allRecords =
			present.length > 0 &&
			present.every((entry) => isPlainObject(entry) && !isMultilingualTextRecord(entry));
		if (allRecords) {
			return itemsFromObjects(present as Record<string, unknown>[]);
		}
		return [inferFromValues(value, "items", 1, 0)];
	}
	if (isPlainObject(value)) {
		if (isMultilingualTextRecord(value)) {
			return [inferFromValues([value], "value", 1, 1)];
		}
		return itemsFromObjects([value]);
	}
	return [inferFromValues([value], "value", 1, 1)];
}

export function countSchemaItems(items: GeneratedSchemaItem[]): number {
	return items.reduce((sum, item) => {
		if (item.kind === "field") {
			return sum + 1;
		}
		return sum + 1 + countSchemaItems(item.items);
	}, 0);
}

export function createSchemaPayloadFromSample(
	schemaId: string,
	storeType: SchemaStoreType,
	sampleText: string
): Record<string, unknown> {
	const parsed = parseSampleDocument(sampleText);
	return {
		...createEmptySchemaPayload(schemaId, storeType),
		items: schemaItemsFromValue(parsed.value),
	};
}

function humanize(name: string): string {
	const spaced = name
		.replace(/[_-]+/g, " ")
		.replace(/([a-z\d])([A-Z])/g, "$1 $2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
		.replace(/\s+/g, " ")
		.trim();
	if (!spaced) {
		return name;
	}
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function labels(itemName: string): { und: string; de: string; en: string } {
	if (itemName === "value" || itemName === "items") {
		const und = itemName === "items" ? "Items" : "Value";
		const de = itemName === "items" ? "Einträge" : "Wert";
		return { und, de, en: und };
	}
	const text = humanize(itemName);
	return { und: text, de: text, en: text };
}

function defaultLiteral(fieldType: GeneratedFieldType): string {
	if (fieldType === "number") {
		return "0";
	}
	if (fieldType === "boolean") {
		return "false";
	}
	return "";
}

function exampleLiteral(value: unknown): string | undefined {
	if (value == null) {
		return undefined;
	}
	const text = typeof value === "string" ? value : String(value);
	if (!text) {
		return undefined;
	}
	return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

function multilingualExample(record: Record<string, unknown>): string | undefined {
	for (const key of ["de", "en", "und", "intl"]) {
		if (typeof record[key] === "string" && record[key]) {
			return exampleLiteral(record[key]);
		}
	}
	for (const entry of Object.values(record)) {
		if (typeof entry === "string" && entry) {
			return exampleLiteral(entry);
		}
	}
	return undefined;
}

function fieldItem(args: {
	itemName: string;
	order: number;
	fieldType: GeneratedFieldType;
	minUsage: number;
	nullable?: boolean;
	example?: string;
}): GeneratedSchemaField {
	const item: GeneratedSchemaField = {
		kind: "field",
		order: args.order,
		dataStructure: {
			itemName: args.itemName,
			default: defaultLiteral(args.fieldType),
			...(args.nullable ? { nullable: true } : {}),
		},
		formProperties: { label: labels(args.itemName) },
		fieldType: args.fieldType,
		itemFlags: {
			readonly: false,
			hidden: false,
			nullable: !!args.nullable,
		},
		minUsage: args.minUsage,
		maxUsage: 1,
	};
	if (args.example) {
		item.example = args.example;
	}
	return item;
}

function groupItem(args: {
	itemName: string;
	order: number;
	collectionType: "array" | "map";
	minUsage: number;
	maxUsage: number;
	items: GeneratedSchemaItem[];
}): GeneratedSchemaGroup {
	return {
		kind: "group",
		order: args.order,
		dataStructure: { itemName: args.itemName },
		formProperties: { label: labels(args.itemName) },
		itemFlags: { readonly: false, hidden: false },
		minUsage: args.minUsage,
		maxUsage: args.maxUsage,
		collectionType: args.collectionType,
		items: args.items,
	};
}

function itemsFromObjects(objects: Record<string, unknown>[]): GeneratedSchemaItem[] {
	const total = objects.length;
	const keys: string[] = [];
	const seen = new Map<string, unknown[]>();
	for (const obj of objects) {
		for (const key of Object.keys(obj)) {
			let values = seen.get(key);
			if (!values) {
				values = [];
				seen.set(key, values);
				keys.push(key);
			}
			values.push(obj[key]);
		}
	}
	return keys.map((key, index) => {
		const values = seen.get(key) ?? [];
		const minUsage = values.length === total ? 1 : 0;
		return inferFromValues(values, key, index + 1, minUsage);
	});
}

function entryItems(elements: unknown[]): GeneratedSchemaItem[] {
	const present = elements.filter((entry) => entry != null);
	if (present.length === 0) {
		return [];
	}
	if (present.every((entry) => isPlainObject(entry) && !isMultilingualTextRecord(entry))) {
		return itemsFromObjects(present as Record<string, unknown>[]);
	}
	if (present.every(Array.isArray)) {
		return [inferFromValues(present, "value", 1, 0)];
	}
	return [inferFromValues(elements, "value", 1, 1)];
}

function inferFromValues(
	values: unknown[],
	itemName: string,
	order: number,
	minUsage: number
): GeneratedSchemaItem {
	const present = values.filter((entry) => entry != null);
	const sawNull = present.length !== values.length;
	if (present.length === 0) {
		return fieldItem({
			itemName,
			order,
			fieldType: "string",
			minUsage,
			nullable: true,
		});
	}
	if (present.every((entry) => isMultilingualTextRecord(entry))) {
		return fieldItem({
			itemName,
			order,
			fieldType: "string",
			minUsage: sawNull ? 0 : minUsage,
			nullable: sawNull,
			example: multilingualExample(present[0] as Record<string, unknown>),
		});
	}
	if (present.every((entry) => isPlainObject(entry))) {
		return groupItem({
			itemName,
			order,
			collectionType: "map",
			minUsage: sawNull ? 0 : minUsage,
			maxUsage: 1,
			items: itemsFromObjects(present as Record<string, unknown>[]),
		});
	}
	if (present.every(Array.isArray)) {
		return groupItem({
			itemName,
			order,
			collectionType: "array",
			minUsage: 0,
			maxUsage: ARRAY_MAX_USAGE,
			items: entryItems(present.flat()),
		});
	}
	const scalars = present.every(
		(entry) => typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean"
	);
	if (!scalars) {
		let example: string | undefined;
		try {
			example = exampleLiteral(JSON.stringify(present[0]));
		} catch {
			example = undefined;
		}
		return fieldItem({
			itemName,
			order,
			fieldType: "string",
			minUsage: sawNull ? 0 : minUsage,
			nullable: sawNull,
			example,
		});
	}
	const fieldType: GeneratedFieldType = present.every((entry) => typeof entry === "boolean")
		? "boolean"
		: present.every((entry) => typeof entry === "number")
			? "number"
			: "string";
	return fieldItem({
		itemName,
		order,
		fieldType,
		minUsage: sawNull ? 0 : minUsage,
		nullable: sawNull,
		example: exampleLiteral(present[0]),
	});
}

function coerceLooseScalar(text: string): unknown {
	const trimmed = text.trim();
	if (trimmed === "") {
		return "";
	}
	if (/^(true|false)$/i.test(trimmed)) {
		return trimmed.toLowerCase() === "true";
	}
	if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed)) {
		return Number(trimmed);
	}
	return trimmed;
}

function parseXmlDocument(text: string): ParsedSampleDocument {
	const doc = new DOMParser().parseFromString(text, "application/xml");
	const root = doc.documentElement;
	if (!root || root.getElementsByTagName("parsererror").length > 0 || root.nodeName === "parsererror") {
		throw new SchemaSampleParseError("xml");
	}
	const tagName = qualifiedXmlName(root);
	return {
		format: "xml",
		value: elementToValue(root),
		suggestedId: optionalSuggestedId(tagName),
	};
}

function qualifiedXmlName(node: Element | Attr): string {
	const qualified = node instanceof Attr ? node.name : node.tagName;
	return qualified || node.localName || "";
}

function elementToValue(element: Element): unknown {
	const result: Record<string, unknown> = {};
	for (const attr of Array.from(element.attributes)) {
		const name = qualifiedXmlName(attr);
		result[name] = attr.value;
	}

	const textParts: string[] = [];
	const childGroups: { name: string; values: unknown[] }[] = [];
	const indexByName = new Map<string, number>();
	for (const node of Array.from(element.childNodes)) {
		if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
			textParts.push(node.textContent ?? "");
			continue;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) {
			continue;
		}
		const child = node as Element;
		const name = qualifiedXmlName(child);
		const value = elementToValue(child);
		const existing = indexByName.get(name);
		if (existing === undefined) {
			indexByName.set(name, childGroups.length);
			childGroups.push({ name, values: [value] });
		} else {
			childGroups[existing].values.push(value);
		}
	}

	const text = textParts.join("").trim();
	const hasAttributes = element.attributes.length > 0;
	const hasChildren = childGroups.length > 0;
	if (!hasAttributes && !hasChildren) {
		return coerceLooseScalar(text);
	}
	if (text) {
		const textKey = "value" in result ? "_text" : "value";
		result[textKey] = coerceLooseScalar(text);
	}
	for (const group of childGroups) {
		let key = group.name;
		if (key in result) {
			key = `_${key}`;
		}
		result[key] = group.values.length > 1 ? group.values : group.values[0];
	}
	return result;
}

function parseYaml(source: string): unknown {
	const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
	if (/(^|\n)[ ]*\t/.test(normalized)) {
		throw new SchemaSampleParseError("tabs");
	}
	const parser = new YamlParser(normalized);
	return parser.parseDocument();
}

function isSequenceItem(content: string): boolean {
	return content === "-" || content.startsWith("- ");
}

function isBlockHeader(value: string): boolean {
	return /^\|[+-]?$/.test(value) || /^>[+-]?$/.test(value);
}

function stripInlineComment(content: string): string {
	let quote: "'" | '"' | null = null;
	for (let index = 0; index < content.length; index += 1) {
		const ch = content[index];
		if (quote) {
			if (ch === "\\" && quote === '"') {
				index += 1;
				continue;
			}
			if (ch === quote) {
				if (quote === "'" && content[index + 1] === "'") {
					index += 1;
					continue;
				}
				quote = null;
			}
			continue;
		}
		if (ch === '"' || ch === "'") {
			quote = ch;
			continue;
		}
		if (ch === "#" && (index === 0 || /\s/.test(content[index - 1]))) {
			return content.slice(0, index).trimEnd();
		}
	}
	return content.trimEnd();
}

function unquote(text: string): string {
	if (text.startsWith('"')) {
		return text
			.slice(1, -1)
			.replace(/\\n/g, "\n")
			.replace(/\\t/g, "\t")
			.replace(/\\r/g, "\r")
			.replace(/\\"/g, '"')
			.replace(/\\\\/g, "\\");
	}
	return text.slice(1, -1).replace(/''/g, "'");
}

function splitKey(content: string): { key: string; value: string } | null {
	if (content.startsWith('"') || content.startsWith("'")) {
		const quote = content[0];
		let index = 1;
		while (index < content.length) {
			if (content[index] === "\\" && quote === '"') {
				index += 2;
				continue;
			}
			if (quote === "'" && content[index] === "'" && content[index + 1] === "'") {
				index += 2;
				continue;
			}
			if (content[index] === quote) {
				const key = unquote(content.slice(0, index + 1));
				const rest = content.slice(index + 1).trim();
				if (!rest.startsWith(":")) {
					return null;
				}
				return { key, value: rest.slice(1).trim() };
			}
			index += 1;
		}
		return null;
	}
	const separator = content.indexOf(":");
	if (separator <= 0) {
		return null;
	}
	return {
		key: content.slice(0, separator).trim(),
		value: content.slice(separator + 1).trim(),
	};
}

function parseScalar(text: string): unknown {
	if (text === "" || text === "~" || text === "null" || text === "Null" || text === "NULL") {
		return null;
	}
	if (
		(text.startsWith('"') && text.endsWith('"') && text.length >= 2) ||
		(text.startsWith("'") && text.endsWith("'") && text.length >= 2)
	) {
		return unquote(text);
	}
	if (/[&*][A-Za-z0-9_]/.test(text)) {
		throw new SchemaSampleParseError("anchor");
	}
	if (text === "true" || text === "True" || text === "TRUE") {
		return true;
	}
	if (text === "false" || text === "False" || text === "FALSE") {
		return false;
	}
	if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text)) {
		return Number(text);
	}
	return text;
}

function parseScalarOrFlow(text: string): unknown {
	const trimmed = text.trim();
	if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
		return parseFlow(trimmed);
	}
	return parseScalar(trimmed);
}

function parseFlow(source: string): unknown {
	let index = 0;

	function skip() {
		while (index < source.length && /\s/.test(source[index])) {
			index += 1;
		}
	}

	function fail(): never {
		throw new SchemaSampleParseError("yaml");
	}

	function parseQuoted(): string {
		const quote = source[index];
		index += 1;
		let out = "";
		while (index < source.length) {
			const ch = source[index];
			if (quote === "'" && ch === "'" && source[index + 1] === "'") {
				out += "'";
				index += 2;
				continue;
			}
			if (quote === '"' && ch === "\\") {
				const next = source[index + 1];
				if (next === "n") out += "\n";
				else if (next === "t") out += "\t";
				else if (next === "r") out += "\r";
				else if (next === '"') out += '"';
				else if (next === "\\") out += "\\";
				else out += next ?? "";
				index += 2;
				continue;
			}
			if (ch === quote) {
				index += 1;
				return out;
			}
			out += ch;
			index += 1;
		}
		return fail();
	}

	function parseFlowKey(): string {
		skip();
		if (source[index] === '"' || source[index] === "'") {
			return parseQuoted();
		}
		const start = index;
		while (index < source.length && source[index] !== ":" && source[index] !== "," && source[index] !== "}" && source[index] !== "]") {
			index += 1;
		}
		const key = source.slice(start, index).trim();
		if (!key) {
			return fail();
		}
		return key;
	}

	function parseFlowScalar(): unknown {
		skip();
		if (source[index] === '"' || source[index] === "'") {
			return parseQuoted();
		}
		const start = index;
		while (index < source.length && source[index] !== "," && source[index] !== "]" && source[index] !== "}") {
			index += 1;
		}
		return parseScalar(source.slice(start, index).trim());
	}

	function parseValue(): unknown {
		skip();
		if (source[index] === "[") {
			return parseSequence();
		}
		if (source[index] === "{") {
			return parseMapping();
		}
		return parseFlowScalar();
	}

	function parseSequence(): unknown[] {
		index += 1;
		const items: unknown[] = [];
		skip();
		if (source[index] === "]") {
			index += 1;
			return items;
		}
		while (index < source.length) {
			items.push(parseValue());
			skip();
			if (source[index] === ",") {
				index += 1;
				skip();
				if (source[index] === "]") {
					index += 1;
					return items;
				}
				continue;
			}
			if (source[index] === "]") {
				index += 1;
				return items;
			}
			return fail();
		}
		return fail();
	}

	function parseMapping(): Record<string, unknown> {
		index += 1;
		const result: Record<string, unknown> = {};
		skip();
		if (source[index] === "}") {
			index += 1;
			return result;
		}
		while (index < source.length) {
			const key = parseFlowKey();
			skip();
			if (source[index] !== ":") {
				return fail();
			}
			index += 1;
			result[key] = parseValue();
			skip();
			if (source[index] === ",") {
				index += 1;
				continue;
			}
			if (source[index] === "}") {
				index += 1;
				return result;
			}
			return fail();
		}
		return fail();
	}

	const value = parseValue();
	skip();
	if (index !== source.length) {
		fail();
	}
	return value;
}

class YamlParser {
	private readonly lines: string[];
	private index = 0;

	constructor(source: string) {
		this.lines = source.split("\n");
	}

	parseDocument(): unknown {
		const next = this.peekContent();
		if (!next) {
			throw new SchemaSampleParseError("empty");
		}
		if (next.content.startsWith("{") || next.content.startsWith("[")) {
			this.consumePeek();
			const value = parseScalarOrFlow(next.content);
			if (this.peekContent()) {
				throw new SchemaSampleParseError("yaml");
			}
			return value;
		}
		const value = this.parseBlock(next.indent);
		if (this.peekContent()) {
			throw new SchemaSampleParseError("yaml");
		}
		return value;
	}

	private indentOf(line: string): number {
		return line.match(/^ */)?.[0].length ?? 0;
	}

	private peekContent(): { index: number; indent: number; content: string } | null {
		let cursor = this.index;
		while (cursor < this.lines.length) {
			const line = this.lines[cursor];
			const trimmed = line.trim();
			if (trimmed === "" || trimmed.startsWith("#")) {
				cursor += 1;
				continue;
			}
			const indent = this.indentOf(line);
			const content = stripInlineComment(line.slice(indent));
			if (content === "---" || content === "..." || content.startsWith("%")) {
				cursor += 1;
				continue;
			}
			return { index: cursor, indent, content };
		}
		return null;
	}

	private consumePeek(): { index: number; indent: number; content: string } {
		const peeked = this.peekContent();
		if (!peeked) {
			throw new SchemaSampleParseError("yaml");
		}
		this.index = peeked.index + 1;
		return peeked;
	}

	private parseBlock(minIndent: number): unknown {
		const next = this.peekContent();
		if (!next || next.indent < minIndent) {
			return null;
		}
		if (isSequenceItem(next.content)) {
			return this.parseSequence(next.indent);
		}
		return this.parseMapping(next.indent);
	}

	private parseMapping(indent: number): Record<string, unknown> {
		const result: Record<string, unknown> = {};
		while (true) {
			const next = this.peekContent();
			if (!next || next.indent !== indent || isSequenceItem(next.content) || !splitKey(next.content)) {
				break;
			}
			this.consumePeek();
			this.assignKey(result, next.content, indent);
		}
		return result;
	}

	private parseSequence(indent: number): unknown[] {
		const items: unknown[] = [];
		while (true) {
			const next = this.peekContent();
			if (!next || next.indent !== indent || !isSequenceItem(next.content)) {
				break;
			}
			this.consumePeek();
			const rest = next.content.replace(/^-\s?/, "");
			if (rest === "") {
				const nested = this.peekContent();
				items.push(!nested || nested.indent <= indent ? null : this.parseBlock(nested.indent));
				continue;
			}
			if (isSequenceItem(rest)) {
				items.push(this.parseNestedInlineSequence(rest, indent));
				continue;
			}
			if (splitKey(rest) && !rest.startsWith("{") && !rest.startsWith("[")) {
				const entry: Record<string, unknown> = {};
				this.assignKey(entry, rest, indent);
				while (true) {
					const more = this.peekContent();
					if (!more || more.indent <= indent || !splitKey(more.content)) {
						break;
					}
					const keyIndent = more.indent;
					this.consumePeek();
					this.assignKey(entry, more.content, keyIndent);
				}
				items.push(entry);
				continue;
			}
			items.push(parseScalarOrFlow(rest));
		}
		return items;
	}

	private parseNestedInlineSequence(rest: string, parentIndent: number): unknown[] {
		const nestedIndent = parentIndent + 2;
		const items: unknown[] = [];
		const pushRest = (text: string) => {
			if (text === "") {
				items.push(null);
				return;
			}
			if (isSequenceItem(text)) {
				items.push(this.parseNestedInlineSequence(text, nestedIndent));
				return;
			}
			items.push(parseScalarOrFlow(text));
		};
		pushRest(rest.replace(/^-\s?/, ""));
		while (true) {
			const more = this.peekContent();
			if (!more || more.indent !== nestedIndent || !isSequenceItem(more.content)) {
				break;
			}
			this.consumePeek();
			pushRest(more.content.replace(/^-\s?/, ""));
		}
		return items;
	}

	private assignKey(target: Record<string, unknown>, content: string, keyIndent: number): void {
		const split = splitKey(content);
		if (!split) {
			throw new SchemaSampleParseError("yaml");
		}
		if (/[&*][A-Za-z0-9_]/.test(split.key)) {
			throw new SchemaSampleParseError("anchor");
		}
		const { key, value } = split;
		if (isBlockHeader(value)) {
			target[key] = this.parseBlockScalar(keyIndent, value);
			return;
		}
		if (value === "") {
			const next = this.peekContent();
			target[key] = !next || next.indent <= keyIndent ? null : this.parseBlock(next.indent);
			return;
		}
		target[key] = parseScalarOrFlow(value);
	}

	private parseBlockScalar(parentIndent: number, header: string): string {
		const fold = header.startsWith(">");
		const keepTrailing = header.includes("+");
		const chunks: string[] = [];
		let contentIndent = -1;
		while (this.index < this.lines.length) {
			const line = this.lines[this.index];
			if (line.trim() === "") {
				let lookahead = this.index + 1;
				while (lookahead < this.lines.length && this.lines[lookahead].trim() === "") {
					lookahead += 1;
				}
				if (lookahead >= this.lines.length) {
					break;
				}
				if (this.indentOf(this.lines[lookahead]) <= parentIndent) {
					break;
				}
				chunks.push("");
				this.index += 1;
				continue;
			}
			const indent = this.indentOf(line);
			if (indent <= parentIndent) {
				break;
			}
			if (contentIndent < 0) {
				contentIndent = indent;
			}
			if (indent < contentIndent) {
				break;
			}
			chunks.push(line.slice(contentIndent));
			this.index += 1;
		}
		while (chunks.length > 0 && chunks[chunks.length - 1] === "") {
			chunks.pop();
		}
		const text = fold
			? chunks.reduce((joined, chunk) => {
					if (!joined) {
						return chunk;
					}
					if (chunk === "") {
						return `${joined}\n`;
					}
					if (joined.endsWith("\n")) {
						return joined + chunk;
					}
					return `${joined} ${chunk}`;
				}, "")
			: chunks.join("\n");
		if (keepTrailing) {
			return `${text}\n`;
		}
		return text;
	}
}
