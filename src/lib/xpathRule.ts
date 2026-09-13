import type {
	XPathRuleRecord,
	XPathRuleType,
} from "../Stores/Models/XPathRule.Model";

export type { XPathRuleRecord, XPathRuleType };

const VALID_TYPES = new Set<XPathRuleType>(["childselect", "positive", "negative"]);

export function isXPathRuleType(value: string): value is XPathRuleType {
	return VALID_TYPES.has(value as XPathRuleType);
}

export function readXPathExpression(rule: unknown): string {
	if (!rule || typeof rule !== "object") {
		return "";
	}
	const xpath = (rule as { xpath?: unknown }).xpath;
	return typeof xpath === "string" ? xpath.trim() : "";
}

export function readXPathRuleType(rule: unknown): XPathRuleType | undefined {
	if (!rule || typeof rule !== "object") {
		return undefined;
	}
	const type = (rule as { type?: unknown }).type;
	return typeof type === "string" && isXPathRuleType(type) ? type : undefined;
}

export function snapshotXPathRules(
	rules: ReadonlyArray<{ xpath?: string; comment?: string; type?: string }>,
	allowedTypes?: readonly XPathRuleType[]
): XPathRuleRecord[] {
	const allowed = allowedTypes ? new Set(allowedTypes) : VALID_TYPES;
	const records: XPathRuleRecord[] = [];
	for (const rule of rules) {
		const type = rule.type && isXPathRuleType(rule.type) ? rule.type : undefined;
		if (!type || !allowed.has(type)) {
			continue;
		}
		const xpath = (rule.xpath ?? "").trim();
		if (!xpath) {
			continue;
		}
		records.push({
			xpath,
			comment: rule.comment ?? "",
			type,
		});
	}
	return records;
}

export function childselectXPaths(rules: unknown[]): string[] {
	if (!Array.isArray(rules)) {
		return [];
	}
	return snapshotXPathRules(
		rules as ReadonlyArray<{ xpath?: string; comment?: string; type?: string }>,
		["childselect"]
	).map((rule) => rule.xpath);
}

export function toXPathRuleRecord(
	xpath: string,
	comment: string,
	type: XPathRuleType
): XPathRuleRecord {
	return {
		xpath: xpath.trim(),
		comment,
		type,
	};
}

export function addXPathRule(
	rules: XPathRuleRecord[],
	xpath: string,
	comment: string,
	type: XPathRuleType
): XPathRuleRecord[] {
	const record = toXPathRuleRecord(xpath, comment, type);
	if (!record.xpath) {
		return rules;
	}
	if (rules.some((rule) => rule.xpath === record.xpath && rule.type === record.type)) {
		return rules;
	}
	return [...rules, record];
}

export function updateXPathRule(
	rules: XPathRuleRecord[],
	index: number,
	patch: Partial<XPathRuleRecord>
): XPathRuleRecord[] {
	if (index < 0 || index >= rules.length) {
		return rules;
	}
	return rules.map((rule, ruleIndex) => {
		if (ruleIndex !== index) {
			return rule;
		}
		return {
			xpath: patch.xpath !== undefined ? patch.xpath.trim() : rule.xpath,
			comment: patch.comment !== undefined ? patch.comment : rule.comment,
			type: patch.type !== undefined ? patch.type : rule.type,
		};
	});
}

export function removeXPathRule(rules: XPathRuleRecord[], index: number): XPathRuleRecord[] {
	if (index < 0 || index >= rules.length) {
		return rules;
	}
	return rules.filter((_, ruleIndex) => ruleIndex !== index);
}

export function xpathRuleSnapshots(rules: XPathRuleRecord[]): XPathRuleRecord[] {
	return rules.map((rule) => ({
		xpath: rule.xpath,
		comment: rule.comment,
		type: rule.type,
	}));
}
