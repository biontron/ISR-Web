import {
	patchConnectionSchemaRestItems,
	patchConnectionSchemaSnapshot,
} from "./connectionSchemaPatch";

describe("connectionSchemaPatch", () => {
	it("benennt Legacy-Felder in links und linkparts um", () => {
		const patched = patchConnectionSchemaSnapshot({
			id: "CONNECTION",
			items: [
				{
					kind: "group",
					dataStructure: { itemName: "links" },
					collectionType: "array",
					items: [
						{
							kind: "field",
							dataStructure: { itemName: "fromAssetRef" },
						},
						{
							kind: "field",
							dataStructure: { itemName: "fromLabel" },
						},
						{
							kind: "group",
							dataStructure: { itemName: "linkparts" },
							collectionType: "array",
							items: [
								{
									kind: "field",
									dataStructure: { itemName: "fromLabel" },
								},
								{
									kind: "field",
									dataStructure: { itemName: "toLabel" },
								},
							],
						},
					],
				},
			],
		});

		const links = (patched.items as any[])[0];
		expect(links.items[0].dataStructure.itemName).toBe("fromComponentRef");
		expect(links.items[1].dataStructure.itemName).toBe("fromLabelSnapshot");
		const linkparts = links.items[2];
		expect(linkparts.items[0].dataStructure.itemName).toBe("fromLabelSnapshot");
		expect(linkparts.items[1].dataStructure.itemName).toBe("toLabelSnapshot");
	});

	it("ergänzt fehlende linkparts-Label-Felder", () => {
		const patched = patchConnectionSchemaSnapshot({
			id: "CONNECTION",
			items: [
				{
					kind: "group",
					dataStructure: { itemName: "links" },
					collectionType: "array",
					items: [
						{
							kind: "group",
							dataStructure: { itemName: "linkparts" },
							collectionType: "array",
							items: [
								{
									kind: "field",
									dataStructure: { itemName: "fromDockpartRef" },
								},
							],
						},
					],
				},
			],
		});

		const linkparts = ((patched.items as any[])[0].items[0].items as any[]).map(
			(entry: { dataStructure: { itemName: string } }) => entry.dataStructure.itemName
		);
		expect(linkparts).toContain("fromLabelSnapshot");
		expect(linkparts).toContain("toLabelSnapshot");
		expect(linkparts).toContain("fromDockpartRef");
	});

	it("patchConnectionSchemaRestItems patcht nur CONNECTION", () => {
		const items = patchConnectionSchemaRestItems([
			{ id: "OTHER", items: [] },
			{
				id: "CONNECTION",
				items: [
					{
						kind: "field",
						dataStructure: { itemName: "toLabel" },
					},
				],
			},
		]);
		expect((items[0] as { id: string }).id).toBe("OTHER");
		expect((items[1] as any).items[0].dataStructure.itemName).toBe("toLabelSnapshot");
	});
});
