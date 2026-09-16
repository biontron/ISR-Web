import { buildElementDefinitionHoverRows, elementDefinitionHoverTitle } from "./elementDefinitionHover";

describe("elementDefinitionHover", () => {
	it("füllt das Hover-Menü aus ElementIdRefType-Feldern", () => {
		expect(
			buildElementDefinitionHoverRows({
				environmentId: "office",
				id: "a-1",
				baseType: "COMPONENT",
				type: "DEVICE",
				subType: "DESKTOP",
				name: "Notebook",
				label: "NB-01",
			})
		).toEqual([
			{ label: "Umgebung", value: "office" },
			{ label: "Type", value: "COMPONENT" },
			{ label: "Subtype", value: "DEVICE" },
			{ label: "Name", value: "Notebook" },
			{ label: "Label", value: "NB-01" },
			{ label: "Descripton", value: "—" },
			{ label: "ID", value: "a-1" },
			{ label: "Status", value: "—" },
		]);
		expect(
			elementDefinitionHoverTitle({
				baseType: "COMPONENT",
				name: "Notebook",
				label: "NB-01",
			})
		).toBe("COMPONENT — Notebook\nNB-01");
	});
});
