import type { ElementMarkFlags } from "./elementXPathValidation";
import {
	collectXPathMatchFieldPaths,
	elementMatchesXPath,
} from "./elementXPathFilter";
import { readXPathExpression, readXPathRuleType } from "./xpathRule";
import { elementStatusShowsIndicator } from "./elementStatusStyle";

export type ElementValidationResult = {
	invalid: boolean;
	marks: ElementMarkFlags;
};

export type ElementXPathMarkOptions = {
	applyPositive?: boolean;
	applyNegative?: boolean;
};

function emptyMarks(changed: boolean): ElementMarkFlags {
	return {
		changed,
		positive: false,
		negative: false,
		searchMatch: false,
		fieldPaths: [],
	};
}

export function collectElementXPathMarks(
	element: { status?: string } | undefined,
	rules: readonly unknown[] | undefined,
	options?: ElementXPathMarkOptions
): ElementMarkFlags {
	const marks = emptyMarks(elementStatusShowsIndicator(element?.status as never));
	if (!element || !rules?.length) {
		return marks;
	}
	const applyPositive = options?.applyPositive !== false;
	const applyNegative = options?.applyNegative !== false;
	for (const rule of rules) {
		const xpath = readXPathExpression(rule);
		const type = readXPathRuleType(rule);
		if (!xpath || (type !== "positive" && type !== "negative")) {
			continue;
		}
		if (type === "positive" && !applyPositive) {
			continue;
		}
		if (type === "negative" && !applyNegative) {
			continue;
		}
		if (!elementMatchesXPath(element as never, xpath)) {
			continue;
		}
		if (type === "negative") {
			marks.negative = true;
		} else {
			marks.positive = true;
		}
		for (const path of collectXPathMatchFieldPaths(element as never, xpath)) {
			if (!marks.fieldPaths.includes(path)) {
				marks.fieldPaths.push(path);
			}
		}
	}
	return marks;
}
