import {
	buildElementDefinitionHoverRows,
	elementDefinitionHoverTitle,
	hoverFieldsFromElementIdRef,
	hoverFieldsFromLiveElement,
} from "./elementDefinitionHover";

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

	it("nimmt elementIdRefs-Arraywerte unverändert", () => {
		expect(
			hoverFieldsFromElementIdRef({
				environmentId: "office",
				id: "a-1",
				baseType: "COMPONENT",
				type: "DEVICE",
				subType: "DESKTOP",
				name: "Notebook",
				label: "NB-01",
			})
		).toEqual({
			environmentId: "office",
			id: "a-1",
			baseType: "COMPONENT",
			type: "DEVICE",
			subType: "DESKTOP",
			name: "Notebook",
			label: "NB-01",
			className: "COMPONENT",
		});
	});

	it("füllt Hover-Felder aus einem geladenen Element", () => {
		expect(
			hoverFieldsFromLiveElement(
				{
					id: "a-1",
					class: "Asset",
					status: "untouched",
					environmentId: "office",
					definition: {
						baseType: "COMPONENT",
						type: "DEVICE",
						subType: "DESKTOP",
						name: "Notebook",
						label: "NB-01",
						description: "Arbeitsplatz",
					},
				},
				{ environment: "Office" }
			)
		).toEqual({
			id: "a-1",
			environmentId: "office",
			environment: "Office",
			baseType: "COMPONENT",
			type: "DEVICE",
			subType: "DESKTOP",
			name: "Notebook",
			label: "NB-01",
			description: "Arbeitsplatz",
			status: "untouched",
			className: "Asset",
		});
	});
});
