import { getSnapshot, types } from "mobx-state-tree";
import { FilterRuleModel } from "../Stores/Models/FilterRule.Model";
import {
	normalizeFilterRules,
	rewriteFilterRulesInSnapshot,
	toFilterRuleRecord,
} from "./filterRuleNormalize";

describe("filterRuleNormalize", () => {
	it("speichert xpath und description", () => {
		expect(
			toFilterRuleRecord(
				{ xpath: "match(definition/name, 'AGLVM')" },
				"Virtuelle Maschinen"
			)
		).toEqual({
			environments: [],
			xpath: "match(definition/name, 'AGLVM')",
			description: "Virtuelle Maschinen",
			activated: false,
		});
		expect(
			normalizeFilterRules([
				{ xpath: "definition/type='DEVICE'", description: "Geräte" },
				{ filterRule: "definition/subType='DESKTOP'" },
			])
		).toEqual([
			{ environments: [], xpath: "definition/type='DEVICE'", description: "Geräte", activated: false },
			{ environments: [], xpath: "definition/subType='DESKTOP'", description: "", activated: false },
		]);
		expect(
			Object.keys(
				toFilterRuleRecord({
					xpath: "definition/type='DEVICE'",
					description: "Geräte",
					environments: [{ ref: "office" }],
					activated: true,
				})
			)
		).toEqual(["environments", "xpath", "description", "activated"]);
	});

	it("schreibt REST/JSON mit xpath und description", () => {
		const snapshot = rewriteFilterRulesInSnapshot({
			id: "g1",
			filterRules: [
				{
					xpath: "match(definition/name, 'AGLVM[A-Z0-9]{2,4}')",
					description: "Virtuelle Maschinen",
				},
			],
		});
		expect(snapshot.filterRules).toEqual([
			{
				environments: [],
				xpath: "match(definition/name, 'AGLVM[A-Z0-9]{2,4}')",
				description: "Virtuelle Maschinen",
				activated: false,
			},
		]);
		expect(JSON.stringify(snapshot)).toContain('"xpath"');
		expect(JSON.stringify(snapshot)).not.toContain('"filterRule"');
	});

	it("getSnapshot mappt legacy filterRule auf xpath", () => {
		const Host = types.model({
			filterRules: types.array(FilterRuleModel),
		});
		const host = Host.create({
			filterRules: [{ filterRule: "definition/type='DEVICE'", description: "Geräte" } as never],
		});
		expect(getSnapshot(host)).toEqual({
			filterRules: [
				{
					environments: [],
					xpath: "definition/type='DEVICE'",
					description: "Geräte",
					activated: false,
				},
			],
		});
		expect(Object.keys(getSnapshot(host).filterRules[0])).toEqual([
			"environments",
			"xpath",
			"description",
			"activated",
		]);
	});
});
