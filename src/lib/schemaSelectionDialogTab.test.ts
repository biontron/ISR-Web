import { resolveCreateDialogTab } from "./schemaSelectionDialogTab";

describe("resolveCreateDialogTab", () => {
	it("nimmt Strukturbaum, wenn View-Groups möglich sind", () => {
		expect(resolveCreateDialogTab(3)).toBe("structure");
	});

	it("nimmt Technische Komponenten, wenn der Strukturbaum leer ist", () => {
		expect(resolveCreateDialogTab(0)).toBe("component");
	});
});
