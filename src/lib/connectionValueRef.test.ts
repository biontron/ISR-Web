import { formatValueRef, parseValueRef } from "./connectionValueRef";

describe("connectionValueRef", () => {
	it("formatiert contextId#valueId", () => {
		expect(formatValueRef("ctx-1", "vlan-10")).toBe("ctx-1#vlan-10");
	});

	it("parst gültige Refs", () => {
		expect(parseValueRef("ctx-1#vlan-10")).toEqual({
			contextId: "ctx-1",
			valueId: "vlan-10",
		});
	});

	it("lehnt leere und unvollständige Refs ab", () => {
		expect(parseValueRef("")).toBeUndefined();
		expect(parseValueRef("nurkontext")).toBeUndefined();
		expect(parseValueRef("#wert")).toBeUndefined();
		expect(parseValueRef("kontext#")).toBeUndefined();
		expect(parseValueRef(null)).toBeUndefined();
	});
});
