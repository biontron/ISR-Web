import { Instance, types } from "mobx-state-tree";

export const XPATH_RULE_TYPES = ["childselect", "positive", "negative"] as const;

export type XPathRuleType = (typeof XPATH_RULE_TYPES)[number];

export type XPathRuleRecord = {
	xpath: string;
	comment: string;
	type: XPathRuleType;
};

export const XPathRuleModel = types.model("XPathRule", {
	xpath: types.string,
	comment: types.string,
	type: types.enumeration("XPathRuleType", [...XPATH_RULE_TYPES]),
});

export type IXPathRule = Instance<typeof XPathRuleModel>;
