import {
	isAbsoluteElementXPath,
	mstPathToXPath,
	resolveSchemaItemLocation,
} from "./schemaEditorLocation";

describe("schemaEditorLocation", () => {
	it("wandelt MST-Prefix in 1-basiertes XPath", () => {
		expect(mstPathToXPath("docks[0].dockparts[1].settings")).toBe(
			"docks[1]/dockparts[2]/settings"
		);
		expect(isAbsoluteElementXPath("class='View'")).toBe(false);
		expect(isAbsoluteElementXPath("/element/definition")).toBe(true);
		expect(isAbsoluteElementXPath("element/class")).toBe(true);
	});

	it("fällt ohne xpath auf itemName plus Prefix zurück", () => {
		const field = {
			kind: "field",
			dataStructure: { itemName: "label" },
			itemFlags: { hidden: false },
		};
		expect(resolveSchemaItemLocation({}, field, "definition")).toEqual({
			visible: true,
			mstPath: "definition.label",
		});
	});

	it("blendet hidden und nicht treffenden Filter aus", () => {
		const hidden = {
			kind: "field",
			dataStructure: { itemName: "secret" },
			itemFlags: { hidden: true },
		};
		expect(resolveSchemaItemLocation({}, hidden, "")).toEqual({
			visible: false,
			mstPath: "secret",
		});

		const filtered = {
			kind: "group",
			dataStructure: { itemName: "elementIdRefs", xpath: "class='View'" },
			itemFlags: { hidden: false },
			minUsage: 0,
			maxUsage: 1,
			collectionType: "map",
			items: [],
		};
		expect(
			resolveSchemaItemLocation({ class: "Asset", definition: {} }, filtered, "").visible
		).toBe(false);
		expect(
			resolveSchemaItemLocation({ class: "View", definition: {} }, filtered, "").visible
		).toBe(true);
	});

	it("hängt relativen Location-XPath an den Dockpart-Prefix", () => {
		const group = {
			kind: "group",
			dataStructure: { itemName: "address", xpath: "address" },
			itemFlags: { hidden: false },
			minUsage: 0,
			maxUsage: 1,
			collectionType: "map",
			items: [],
		};
		const element = {
			class: "Asset",
			definition: { type: "DEVICE" },
			docks: [
				{
					id: "d1",
					dockparts: [
						{ id: "1", type: "IPv4", settings: { address: { ip: "10.0.0.1" } } },
					],
				},
			],
		};
		const resolved = resolveSchemaItemLocation(element, group, "docks[0].dockparts[0]");
		expect(resolved.visible).toBe(true);
		expect(resolved.mstPath).toBe("docks[0].dockparts[0].settings.address");
	});
});
