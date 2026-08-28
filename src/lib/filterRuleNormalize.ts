export type FilterRuleRecord = {
	xpath: string;
	description: string;
};

export function filterRuleExpression(rule: unknown): string {
	if (typeof rule === "string") {
		return rule.trim();
	}
	if (rule && typeof rule === "object") {
		const record = rule as Record<string, unknown>;
		const value =
			record.xpath ?? record.filterRule ?? record.expression ?? record.filter;
		if (typeof value === "string") {
			return value.trim();
		}
	}
	return "";
}

export function filterRuleDescription(rule: unknown): string {
	if (rule && typeof rule === "object") {
		const value = (rule as Record<string, unknown>).description;
		if (typeof value === "string") {
			return value;
		}
	}
	return "";
}

export function toFilterRuleRecord(rule: unknown, description?: string): FilterRuleRecord {
	return {
		xpath: typeof rule === "string" ? rule.trim() : filterRuleExpression(rule),
		description: description !== undefined ? description : filterRuleDescription(rule),
	};
}

export function normalizeFilterRules(rules: unknown): FilterRuleRecord[] {
	if (!Array.isArray(rules)) {
		return [];
	}
	return rules.map((rule) => toFilterRuleRecord(rule));
}

export function rewriteFilterRulesInSnapshot<T>(snapshot: T): T {
	if (!snapshot || typeof snapshot !== "object") {
		return snapshot;
	}
	const record = snapshot as T & { filterRules?: unknown };
	if (!("filterRules" in record)) {
		return snapshot;
	}
	return {
		...record,
		filterRules: normalizeFilterRules(record.filterRules),
	};
}
