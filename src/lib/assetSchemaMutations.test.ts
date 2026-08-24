import { buildDockEntryFromSchemaItems } from "./assetSchemaMutations";

function assetStub() {
	return {
		class: "Asset",
		docks: [{ id: "D-existingDock00000000001", type: "", dockparts: [] }],
	};
}

describe("buildDockEntryFromSchemaItems", () => {
	it("liefert nur MST-Dock-Felder und eine Dock-ID", () => {
		const items = [
			{
				kind: "field",
				dataStructure: { itemName: "id", default: "" },
				rules: "[\\x20-\\x7E]{1,50}",
				minUsage: 1,
			},
			{
				kind: "field",
				dataStructure: { itemName: "type", default: "" },
				rules: "[\\x20-\\x7E]{1,50}",
				example: "Webserver",
				minUsage: 1,
			},
			{
				kind: "group",
				dataStructure: { itemName: "dockparts" },
				collectionType: "array",
				minUsage: 0,
				maxUsage: 50,
				items: [],
			},
			{
				kind: "field",
				dataStructure: { itemName: "ownerType", default: "COMPONENT" },
				minUsage: 0,
			},
		];

		const entry = buildDockEntryFromSchemaItems(assetStub() as never, "docks", items as never);

		expect(entry.id).toMatch(/^D-[A-Za-z0-9]{22}$/);
		expect(entry.id).not.toBe("D-existingDock00000000001");
		expect(entry).toEqual({
			id: entry.id,
			type: expect.any(String),
			label: "",
			dockparts: [],
		});
		expect(entry).not.toHaveProperty("ownerType");
	});
});
