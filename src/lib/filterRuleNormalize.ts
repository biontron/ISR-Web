export type FilterRuleEnvironmentRef = {
	ref: string;
};

export type FilterRuleRecord = {
	environments: FilterRuleEnvironmentRef[];
	xpath: string;
	description: string;
	activated: boolean;
};

function readFilterRuleEnvironments(rule: unknown): FilterRuleEnvironmentRef[] {
	if (!rule || typeof rule !== "object") {
		return [];
	}
	const raw = (rule as { environments?: unknown }).environments;
	if (!Array.isArray(raw)) {
		return [];
	}
	const seen = new Set<string>();
	const refs: FilterRuleEnvironmentRef[] = [];
	for (const entry of raw) {
		const ref = typeof entry === "string"
			? entry.trim()
			: typeof (entry as { ref?: unknown })?.ref === "string"
				? String((entry as { ref: string }).ref).trim()
				: "";
		if (!ref || seen.has(ref)) {
			continue;
		}
		seen.add(ref);
		refs.push({ ref });
	}
	return refs;
}

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

export function filterRuleActivated(rule: unknown): boolean {
	if (rule && typeof rule === "object") {
		return (rule as Record<string, unknown>).activated === true;
	}
	return false;
}

export function toFilterRuleRecord(rule: unknown, description?: string): FilterRuleRecord {
	return {
		environments: readFilterRuleEnvironments(rule),
		xpath: typeof rule === "string" ? rule.trim() : filterRuleExpression(rule),
		description: description !== undefined ? description : filterRuleDescription(rule),
		activated: filterRuleActivated(rule),
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
