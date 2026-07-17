import {
	nextNumericIdFromRules,
	resolveFieldValueOnAdd,
} from "./schemaAddFieldDefaults";

describe("schemaAddFieldDefaults", () => {
	it("vergibt nächste numerische ID gemäß rules", () => {
		expect(nextNumericIdFromRules("^([1-9][0-9]?)$", ["1", "2"])).toBe("3");
		expect(nextNumericIdFromRules("^([1-9][0-9]?)$", [])).toBe("1");
	});

	it("resolveFieldValueOnAdd nutzt siblingArrayPath für numerische ids", () => {
		const element = {
			docks: [
				{
					id: "dabc123456",
					dockparts: [{ id: "1" }, { id: "2" }],
				},
			],
		};

		const value = resolveFieldValueOnAdd(
			{
				dataStructure: { itemName: "id", default: "" },
				rules: "^([1-9][0-9]?)$",
			} as any,
			{
				element,
				dataPathPrefix: "docks[0].dockparts",
				siblingArrayPath: "docks[0].dockparts",
			}
		);

		expect(value).toBe("3");
	});

	it("resolveFieldValueOnAdd erzeugt Dock-ID mit d-Präfix für docks[]", () => {
		const value = resolveFieldValueOnAdd(
			{
				dataStructure: { itemName: "id", default: "" },
				rules: "[\\x20-\\x7E]{1,50}",
			} as any,
			{
				element: { docks: [] },
				dataPathPrefix: "docks",
				siblingArrayPath: "docks",
			}
		);

		expect(String(value)).toMatch(/^D-[A-Za-z0-9]{22}$/);
		expect(String(value).slice(2)).toHaveLength(22);
	});
});
