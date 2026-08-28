import { Instance, types } from "mobx-state-tree";
import { toFilterRuleRecord } from "../../lib/filterRuleNormalize";

export const FilterRuleModel = types
	.model("FilterRule", {
		xpath: types.optional(types.string, ""),
		description: types.optional(types.string, ""),
	})
	.preProcessSnapshot((snapshot) => toFilterRuleRecord(snapshot));

export type IFilterRule = Instance<typeof FilterRuleModel>;
