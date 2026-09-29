import { collectElementXPathMarks } from "./elementValidation";

describe("elementValidation", () => {
	it("sammelt XPath-Marks für das ganze Element", () => {
		const element = {
			id: "a1",
			class: "Asset",
			status: "changed",
			definition: { type: "DEVICE", name: "n1" },
		};
		const marks = collectElementXPathMarks(element, [
			{ xpath: "definition/type='DEVICE'", comment: "Gerät", type: "positive" },
			{ xpath: "definition/name='other'", comment: "Name", type: "negative" },
		]);
		expect(marks.changed).toBe(true);
		expect(marks.positive).toBe(true);
		expect(marks.negative).toBe(false);
		expect(marks.fieldPaths.length).toBeGreaterThan(0);
	});

	it("respektiert Toolbar-Flags", () => {
		const element = {
			id: "a1",
			class: "Asset",
			status: "untouched",
			definition: { type: "DEVICE" },
		};
		const marks = collectElementXPathMarks(
			element,
			[{ xpath: "definition/type='DEVICE'", comment: "", type: "positive" }],
			{ applyPositive: false }
		);
		expect(marks.positive).toBe(false);
	});
});
