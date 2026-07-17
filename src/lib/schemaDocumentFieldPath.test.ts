import { resolveSchemaDocumentFieldPath } from "./schemaDocumentFieldPath";

describe("resolveSchemaDocumentFieldPath", () => {
	const asset = { class: "Asset", definition: { baseType: "DEVICE", name: "X" } };

	it("mappt type nur unter definition.* auf baseType", () => {
		const field = { dataStructure: { itemName: "type" } } as any;

		expect(resolveSchemaDocumentFieldPath(asset, field, "definition")).toBe("definition.type");
		expect(resolveSchemaDocumentFieldPath(asset, field, "docks[0]")).toBe("docks[0].type");
	});

	it("fügt settings für schema-Felder in dockparts ein", () => {
		const ipField = { dataStructure: { itemName: "ip" } } as any;
		expect(resolveSchemaDocumentFieldPath(asset, ipField, "docks[1].dockparts[1].address")).toBe(
			"docks[1].dockparts[1].settings.address.ip"
		);
	});
});
