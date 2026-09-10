import { Instance, types } from "mobx-state-tree";

export type ValidationRulePolarity = "positive" | "negative";

export type ValidationRuleRecord = {
	xpath: string;
	description: string;
	polarity: ValidationRulePolarity;
};

export const ValidationRuleModel = types.model("ValidationRule", {
	xpath: types.string,
	description: types.string,
	polarity: types.enumeration("ValidationRulePolarity", ["positive", "negative"]),
});

export type IValidationRule = Instance<typeof ValidationRuleModel>;
