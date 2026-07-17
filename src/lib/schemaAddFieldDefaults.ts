import { ISchemaFieldModel } from "../Stores/Models/SchemaField.Model";
import { getValueByPath } from "./path";
import { generateResourceId } from "./resourceId";

export interface SchemaAddFieldContext {
	element: unknown;
	dataPathPrefix: string;
	siblingArrayPath?: string;
}

function parseRegexRules(rules: string | undefined): RegExp | undefined {
	if (!rules || typeof rules !== "string") {
		return undefined;
	}
	try {
		return new RegExp(rules);
	} catch {
		return undefined;
	}
}

function collectSiblingFieldValues(
	element: unknown,
	arrayPath: string | undefined,
	fieldName: string
): string[] {
	if (!arrayPath || !element) {
		return [];
	}
	const array = getValueByPath(element, arrayPath);
	if (!Array.isArray(array)) {
		return [];
	}
	return array
		.map((entry) => {
			if (entry == null || typeof entry !== "object") {
				return "";
			}
			const value = (entry as Record<string, unknown>)[fieldName];
			return value == null ? "" : String(value);
		})
		.filter(Boolean);
}

/** Nächste numerische ID gemäß rules wie ^([1-9][0-9]?)$ oder [0-9]+ */
export function nextNumericIdFromRules(
	rules: string | undefined,
	existingValues: string[]
): string | undefined {
	const numericPattern = parseRegexRules(rules);
	if (!numericPattern) {
		return undefined;
	}

	const used = new Set(
		existingValues
			.map((value) => parseInt(value, 10))
			.filter((n) => Number.isFinite(n) && n > 0)
	);

	for (let candidate = 1; candidate <= 99; candidate += 1) {
		const asString = String(candidate);
		if (used.has(candidate)) {
			continue;
		}
		if (numericPattern.test(asString)) {
			return asString;
		}
	}

	return undefined;
}

function randomCharFromClass(charClass: string): string {
	if (charClass.includes("A-Z") && charClass.includes("a-z") && charClass.includes("0-9")) {
		const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		return chars[Math.floor(Math.random() * chars.length)];
	}
	if (charClass === "0-9" || charClass.includes("0-9")) {
		return String(Math.floor(Math.random() * 10));
	}
	return "x";
}

function isNumericIdRules(rules: string | undefined): boolean {
	if (!rules) {
		return false;
	}
	return (
		/\[1-9\]/.test(rules) ||
		/\[0-9\]/.test(rules) ||
		/^\^\([1-9]/.test(rules) ||
		/^\+?\[0-9\]/.test(rules)
	);
}

function isDockArrayIdContext(context: SchemaAddFieldContext): boolean {
	return (
		context.siblingArrayPath === "docks" ||
		/^docks(\[\d+\])?$/.test(context.siblingArrayPath ?? "")
	);
}

/** Dock-ID: D-[A-Za-z0-9]{22} (UUID in Base62). */
export function generateDockId(existingValues: string[] = []): string {
	return generateResourceId("Dock", existingValues);
}

/** Erzeugt einen Wert passend zu rules wie ^D-[A-Za-z0-9]{22}$ */
function generateFromPatternRules(rules: string): string | undefined {
	const anchored = rules.startsWith("^") ? rules : `^${rules}$`;
	const resourceIdMatch = anchored.match(/^\^([VGADCE])-\[A-Za-z0-9\]\{(\d+)\}\$/i);
	if (resourceIdMatch) {
		const prefix = resourceIdMatch[1].toUpperCase();
		const repeat = parseInt(resourceIdMatch[2], 10);
		const typeByPrefix: Record<string, Parameters<typeof generateResourceId>[0]> = {
			V: "View",
			G: "Group",
			A: "Asset",
			D: "Dock",
			C: "Connection",
			E: "Environment",
		};
		const resourceType = typeByPrefix[prefix];
		if (resourceType && repeat === 22) {
			return generateResourceId(resourceType);
		}
	}

	const prefixMatch = anchored.match(/^\^([^\[]+)\[/);
	if (!prefixMatch) {
		return undefined;
	}
	const prefix = prefixMatch[1].replace(/\\/g, "");
	const repeatMatch = anchored.match(/\{(\d+)\}/);
	const repeat = repeatMatch ? parseInt(repeatMatch[1], 10) : 0;
	if (repeat <= 0) {
		return undefined;
	}

	let suffix = "";
	for (let i = 0; i < repeat; i += 1) {
		suffix += randomCharFromClass("A-Za-z0-9");
	}
	const candidate = `${prefix}${suffix}`;
	const regex = parseRegexRules(rules.startsWith("^") ? rules : `^${rules}$`);
	return regex?.test(candidate) ? candidate : `${prefix}${suffix}`;
}

export function resolveFieldValueOnAdd(
	field: ISchemaFieldModel,
	context: SchemaAddFieldContext
): unknown | undefined {
	const fieldName = field.dataStructure.itemName;
	const rules = field.rules;
	const regex = parseRegexRules(rules);

	if (fieldName === "id" && isDockArrayIdContext(context)) {
		const existing = collectSiblingFieldValues(
			context.element,
			context.siblingArrayPath,
			fieldName
		);
		return generateDockId(existing);
	}

	if (fieldName === "id" && context.siblingArrayPath && isNumericIdRules(rules)) {
		const existing = collectSiblingFieldValues(
			context.element,
			context.siblingArrayPath,
			fieldName
		);
		const numeric = nextNumericIdFromRules(rules, existing);
		if (numeric !== undefined) {
			return numeric;
		}
	}

	if (fieldName === "id" && rules) {
		const generated = generateFromPatternRules(rules);
		if (generated) {
			return generated;
		}
		if (/\\x20-\\x7E/.test(rules) && context.dataPathPrefix.startsWith("docks")) {
			return generateDockId();
		}
	}

	if (regex && field.example) {
		const example = String(field.example);
		if (regex.test(example)) {
			return example;
		}
	}

	const fromDefault = field.dataStructure?.default;
	if (fromDefault !== undefined && fromDefault !== "") {
		return fromDefault;
	}

	return undefined;
}
