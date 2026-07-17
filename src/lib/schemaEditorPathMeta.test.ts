import {
	formatMstValuePreview,
	formatSchemaFieldTypeLabel,
	formatSchemaGroupTypeLabel,
} from "./schemaEditorPathMeta";

describe("schemaEditorPathMeta", () => {
	it("formatMstValuePreview kürzt lange Werte", () => {
		expect(formatMstValuePreview(undefined)).toBe("∅");
		expect(formatMstValuePreview(null)).toBe("null");
		expect(formatMstValuePreview("192.168.0.1")).toBe("192.168.0.1");
		expect(formatMstValuePreview("x".repeat(200)).endsWith("…")).toBe(true);
	});

	it("formatSchemaFieldTypeLabel enthält nullable", () => {
		const field = {
			fieldType: "string",
			dataStructure: { nullable: true },
			itemFlags: { nullable: false },
		} as any;
		expect(formatSchemaFieldTypeLabel(field)).toBe("string (nullable)");
	});

	it("formatSchemaGroupTypeLabel beschreibt collectionType und Kardinalität", () => {
		const group = {
			collectionType: "map",
			minUsage: 1,
			maxUsage: 1,
		} as any;
		expect(formatSchemaGroupTypeLabel(group)).toBe("map [1..1]");
	});
});
