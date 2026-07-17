import { buildElementStatusClass, elementStatusShowsIndicator } from "./elementStatusStyle";

describe("elementStatusStyle", () => {
	it("zeigt keinen Indikator für untouched", () => {
		expect(elementStatusShowsIndicator("untouched")).toBe(false);
		expect(buildElementStatusClass("frame", "untouched")).toBe("frame");
	});

	it("mappt Element-Status direkt auf CSS-Klassen", () => {
		expect(buildElementStatusClass("frame", "invalid")).toBe("frame frame--invalid");
		expect(buildElementStatusClass("frame", "changed")).toBe("frame frame--changed");
		expect(buildElementStatusClass("frame", "new")).toBe("frame frame--new");
	});
});
