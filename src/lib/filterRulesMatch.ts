type DefinitionLike = {
	type?: string;
	subType?: string;
	baseType?: string;
	storeType?: string;
	name?: string;
	label?: string;
};

type AssetLike = { definition?: DefinitionLike };

function trimField(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function definitionValue(asset: AssetLike, key: keyof DefinitionLike): string {
	return trimField(asset.definition?.[key]);
}

export function extractFilterRuleExpression(rule: unknown): string | undefined {
	if (typeof rule === "string") {
		const trimmed = rule.trim();
		return trimmed || undefined;
	}
	if (!rule || typeof rule !== "object") {
		return undefined;
	}
	const record = rule as Record<string, unknown>;
	for (const key of ["xpath", "xPath", "expression", "path", "filter"]) {
		const value = trimField(record[key]);
		if (value) {
			return value;
		}
	}
	return undefined;
}

function predicateMatches(asset: AssetLike, attr: string, expected: string): boolean {
	const aliases: Record<string, Array<keyof DefinitionLike>> = {
		type: ["type"],
		subtype: ["subType"],
		subType: ["subType"],
		name: ["name"],
		label: ["label"],
		basetype: ["baseType"],
		baseType: ["baseType"],
		storetype: ["storeType"],
		storeType: ["storeType"],
	};
	const keys = aliases[attr] ?? aliases[attr.toLowerCase()];
	if (!keys) {
		return false;
	}
	return keys.some((key) => definitionValue(asset, key) === expected);
}

function collectGlobalMatches(source: string, pattern: string): RegExpExecArray[] {
	const regex = new RegExp(pattern, "g");
	const matches: RegExpExecArray[] = [];
	let match = regex.exec(source);
	while (match) {
		matches.push(match);
		match = regex.exec(source);
	}
	return matches;
}

export function assetMatchesXPath(asset: AssetLike, xpath: string): boolean {
	const expr = xpath.trim();
	if (!expr) {
		return false;
	}

	const predicates = collectGlobalMatches(
		expr,
		"\\[@([A-Za-z_][\\w]*)\\s*=\\s*['\"]([^'\"]+)['\"]\\]"
	);
	if (predicates.length > 0) {
		return predicates.every((match) => predicateMatches(asset, match[1], match[2]));
	}

	const segments = collectGlobalMatches(expr, "\\/\\/?([A-Za-z_][\\w-]*)").map(
		(match) => match[1]
	);
	const typeLike = segments.filter(
		(segment) => segment !== "*" && segment.toLowerCase() !== "folder"
	);
	if (typeLike.length === 0) {
		return false;
	}
	const last = typeLike[typeLike.length - 1];
	return (["type", "baseType", "subType", "name"] as const).some(
		(key) => definitionValue(asset, key) === last
	);
}

export function assetMatchesFilterRule(asset: AssetLike, rule: unknown): boolean {
	if (rule && typeof rule === "object" && !Array.isArray(rule)) {
		const record = rule as Record<string, unknown>;
		const equalityKeys = ["type", "subType", "baseType", "storeType", "name"] as const;
		const specified = equalityKeys.filter((key) => trimField(record[key]));
		if (specified.length > 0) {
			return specified.every(
				(key) => definitionValue(asset, key) === trimField(record[key])
			);
		}
	}
	const expr = extractFilterRuleExpression(rule);
	if (!expr) {
		return false;
	}
	return assetMatchesXPath(asset, expr);
}

export function assetMatchesAnyFilterRule(
	asset: AssetLike,
	rules: readonly unknown[] | undefined
): boolean {
	if (!rules?.length) {
		return false;
	}
	return rules.some((rule) => assetMatchesFilterRule(asset, rule));
}

export function assetsMatchingFilterRules<T extends AssetLike>(
	assets: readonly T[],
	rules: readonly unknown[] | undefined
): T[] {
	if (!rules?.length) {
		return [];
	}
	return assets.filter((asset) => assetMatchesAnyFilterRule(asset, rules));
}
