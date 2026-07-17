import {
	createDockpartSchemaPreviewInstance,
	createEditorSchemaPreviewInstance,
	resolveLiveDockpartSchemaDefinition,
	resolveLiveEditorSchemaDefinition,
} from "./schemaPreviewInstances";

describe("schemaPreviewInstances", () => {
	it("resolveLiveEditorSchemaDefinition sortiert Items nach order", () => {
		const schema = {
			id: "DEVICE",
			type: "DEVICE",
			items: [
				{ order: 2, dataStructure: { itemName: "b" }, formProperties: { label: {} } },
				{ order: 1, dataStructure: { itemName: "a" }, formProperties: { label: {} } },
			],
		} as any;

		const resolved = resolveLiveEditorSchemaDefinition(schema);
		expect(resolved.items.map((item) => item.dataStructure.itemName)).toEqual(["a", "b"]);
	});

	it("createEditorSchemaPreviewInstance baut settings-Vorschau für Element-Schema", () => {
		const schema = {
			id: "DEVICE",
			type: "DEVICE",
			storeType: "COMPONENT",
			baseType: "COMPONENT",
			subType: "DESKTOP",
			items: [
				{
					order: 1,
					kind: "field",
					dataStructure: { itemName: "serial", default: "" },
					formProperties: { label: { und: "Serial" } },
					fieldType: "string",
					minUsage: 0,
					maxUsage: 1,
				},
			],
		} as any;

		const preview = createEditorSchemaPreviewInstance(schema);
		expect(preview.settings).toBeDefined();
		expect((preview.definition as { type: string; baseType: string; subType: string }).type).toBe(
			"DEVICE"
		);
		expect((preview.definition as { type: string; baseType: string; subType: string }).baseType).toBe(
			"COMPONENT"
		);
		expect((preview.definition as { type: string; baseType: string; subType: string }).subType).toBe(
			"DESKTOP"
		);
	});

	it("createDockpartSchemaPreviewInstance nutzt live Schema-Items", () => {
		const schema = {
			id: "IPV4",
			type: "IPv4",
			items: [
				{
					order: 1,
					kind: "field",
					dataStructure: { itemName: "protocol", default: "IP" },
					formProperties: { label: { und: "Protocol" } },
					fieldType: "string",
					minUsage: 0,
					maxUsage: 1,
				},
			],
		} as any;

		const preview = createDockpartSchemaPreviewInstance(schema);
		expect(preview.type).toBe("IPv4");
		expect(resolveLiveDockpartSchemaDefinition(schema).id).toBe("IPV4");
	});
});
