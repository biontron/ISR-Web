import { Instance, types } from "mobx-state-tree";
import { toFilterRuleRecord } from "../../lib/filterRuleNormalize";

export const FilterRuleModel = types
	.model("FilterRule", {
		environments: types.optional(
			types.array(
				types.model({
					ref: types.string,
				})
			),
			[]
		),
		xpath: types.optional(types.string, ""),
		description: types.optional(types.string, ""),
		activated: types.optional(types.boolean, false),
	})
	.preProcessSnapshot((snapshot) => toFilterRuleRecord(snapshot))
	.postProcessSnapshot((snapshot) => ({
		environments: snapshot.environments,
		xpath: snapshot.xpath,
		description: snapshot.description,
		activated: snapshot.activated,
	}));

export type IFilterRule = Instance<typeof FilterRuleModel>;
