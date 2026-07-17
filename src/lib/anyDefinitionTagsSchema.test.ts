import {
	patchAnyDefinitionSchemaSnapshot,
	patchInternalSchemaRestItems,
} from "./anyDefinitionTagsSchema";

describe("anyDefinitionTagsSchema", () => {
	it("wandelt definition.tags von map in array um", () => {
		const schema = patchAnyDefinitionSchemaSnapshot({
			id: "ANY-DEFINITION",
			items: [
				{
					kind: "group",
					dataStructure: { itemName: "definition" },
					collectionType: "map",
					minUsage: 1,
					maxUsage: 1,
					items: [
						{
							kind: "group",
							dataStructure: { itemName: "tags" },
							collectionType: "map",
							minUsage: 1,
							maxUsage: 1,
							items: [
								{
									kind: "field",
									dataStructure: { itemName: "tag" },
									fieldType: "string",
								},
							],
						},
					],
				},
			],
		});

		const tags = (schema.items as any[])[0].items[0];
		expect(tags.collectionType).toBe("array");
		expect(tags.minUsage).toBe(0);
		expect(tags.items).toHaveLength(1);
		expect(tags.items[0].dataStructure.itemName).toBe("tag");
	});

	it("flacht verschachtelte map-Wrapper in tags-Array-Einträgen ab", () => {
		const schema = patchAnyDefinitionSchemaSnapshot({
			id: "ANY-DEFINITION",
			items: [
				{
					kind: "group",
					dataStructure: { itemName: "definition" },
					items: [
						{
							kind: "group",
							dataStructure: { itemName: "tags" },
							collectionType: "array",
							minUsage: 0,
							maxUsage: 10,
							items: [
								{
									kind: "group",
									dataStructure: { itemName: "tag" },
									collectionType: "map",
									minUsage: 1,
									maxUsage: 1,
									items: [
										{
											kind: "field",
											dataStructure: { itemName: "tag" },
											fieldType: "string",
										},
									],
								},
							],
						},
					],
				},
			],
		});

		const tags = (schema.items as any[])[0].items[0];
		expect(tags.collectionType).toBe("array");
		expect(tags.items).toHaveLength(1);
		expect(tags.items[0].kind).toBe("field");
	});

	it("normalisiert tags-Array mit maxUsage 0 und leeren items", () => {
		const schema = patchAnyDefinitionSchemaSnapshot({
			id: "ANY-DEFINITION",
			items: [
				{
					kind: "group",
					dataStructure: { itemName: "definition" },
					items: [
						{
							kind: "group",
							dataStructure: { itemName: "tags" },
							collectionType: "array",
							minUsage: 0,
							maxUsage: 0,
							items: [],
						},
					],
				},
			],
		});

		const tags = (schema.items as any[])[0].items[0];
		expect(tags.collectionType).toBe("array");
		expect(tags.maxUsage).toBe(50);
		expect(tags.items).toHaveLength(1);
		expect(tags.items[0].dataStructure.itemName).toBe("tag");
	});

	it("patchInternalSchemaRestItems trifft nur ANY-DEFINITION", () => {
		const patched = patchInternalSchemaRestItems([
			{ id: "OTHER" },
			{
				id: "ANY-DEFINITION",
				items: [
					{
						kind: "group",
						dataStructure: { itemName: "definition" },
						items: [
							{
								kind: "group",
								dataStructure: { itemName: "tags" },
								collectionType: "map",
								minUsage: 1,
								maxUsage: 1,
								items: [
									{
										kind: "field",
										dataStructure: { itemName: "tag" },
									},
								],
							},
						],
					},
				],
			},
		]);

		expect((patched[0] as { id: string }).id).toBe("OTHER");
		expect((patched[1] as any).items[0].items[0].collectionType).toBe("array");
	});
});
