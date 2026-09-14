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

	it("hebt flache Link- und Linkpart-Wrapper an", () => {
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
							dataStructure: { itemName: "link" },
							collectionType: "map",
							minUsage: 1,
							maxUsage: 1,
							items: [
								{ kind: "field", dataStructure: { itemName: "id" } },
								{ kind: "field", dataStructure: { itemName: "fromAssetRef" } },
								{
									kind: "group",
									dataStructure: { itemName: "linkparts" },
									collectionType: "array",
									items: [
										{
											kind: "group",
											dataStructure: { itemName: "" },
											collectionType: "map",
											minUsage: 1,
											maxUsage: 1,
											formProperties: { label: { de: "Link-Teil" } },
											items: [
												{ kind: "field", dataStructure: { itemName: "fromLabel" } },
												{ kind: "field", dataStructure: { itemName: "fromDockpartRef" } },
												{ kind: "field", dataStructure: { itemName: "stackOrder" } },
											],
										},
									],
								},
							],
						},
					],
				},
			],
		});

		const links = (patched.items as any[])[0];
		const linkItemNames = links.items.map(
			(entry: { dataStructure: { itemName: string } }) => entry.dataStructure.itemName
		);
		expect(linkItemNames).toContain("id");
		expect(linkItemNames).toContain("fromComponentRef");
		expect(linkItemNames).toContain("linkparts");
		expect(linkItemNames).toContain("credentials");
		expect(linkItemNames).not.toContain("link");

		const linkparts = links.items.find(
			(entry: { dataStructure: { itemName: string } }) => entry.dataStructure.itemName === "linkparts"
		);
		const partNames = linkparts.items.map(
			(entry: { dataStructure: { itemName: string } }) => entry.dataStructure.itemName
		);
		expect(partNames).toContain("fromLabelSnapshot");
		expect(partNames).toContain("fromDockpartRef");
		expect(partNames).toContain("stackOrder");
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
