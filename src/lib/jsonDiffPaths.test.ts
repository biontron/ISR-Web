import { collectChangedJsonPaths, isJsonPathChanged } from "./jsonDiffPaths";

describe("jsonDiffPaths", () => {
	it("findet geänderte Blätter und verschachtelte Pfade", () => {
		const baseline = {
			id: "a1",
			definition: { name: "Alt", baseType: "DEVICE" },
			properties: { style: { bgColor: "#fff" } },
		};
		const current = {
			id: "a1",
			definition: { name: "Neu", baseType: "DEVICE" },
			properties: { style: { bgColor: "#000" } },
		};

		const changed = collectChangedJsonPaths(baseline, current);
		expect(changed.has("definition.name")).toBe(true);
		expect(changed.has("properties.style.bgColor")).toBe(true);
		expect(isJsonPathChanged("properties", changed)).toBe(true);
		expect(isJsonPathChanged("id", changed)).toBe(false);
	});

	it("markiert neue Array-Einträge", () => {
		const changed = collectChangedJsonPaths({ versions: [] }, { versions: [{ version: "1" }] });
		expect(changed.has("versions[0]")).toBe(true);
	});
});
