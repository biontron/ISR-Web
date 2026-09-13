import { Instance } from "mobx-state-tree";
import {
	XPathRuleModel,
	type XPathRuleRecord,
	type XPathRuleType,
} from "./XPathRule.Model";

export type ValidationRuleType = Extract<XPathRuleType, "positive" | "negative">;

export type ValidationRuleRecord = XPathRuleRecord & {
	type: ValidationRuleType;
};

export const ValidationRuleModel = XPathRuleModel;

export type IValidationRule = Instance<typeof ValidationRuleModel>;
export type { XPathRuleRecord, XPathRuleType };
