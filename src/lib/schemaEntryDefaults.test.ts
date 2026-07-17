import {
	buildDefaultEntryFromSchemaItems,
	buildDefaultsFromSchemaItems,
	buildMandatoryGroupValue,
} from "./schemaEntryDefaults";

describe("schemaEntryDefaults", () => {
	it("baut Array-Eintrag mit Pflichtfeld version", () => {
		const entry = buildDefaultEntryFromSchemaItems([
			{
				kind: "field",
				dataStructure: { itemName: "version", default: "4" },
				fieldType: "string",
				minUsage: 1,
				maxUsage: 1,
			} as any,
		]);
		expect(entry).toEqual({ version: "4" });
	});

	it("baut Pflichtfeld auch ohne Schema-Default", () => {
		const entry = buildDefaultEntryFromSchemaItems([
			{
				kind: "field",
				dataStructure: { itemName: "dockpartId" },
				fieldType: "number",
				minUsage: 1,
				maxUsage: 1,
			} as any,
		]);
		expect(entry).toEqual({ dockpartId: 0 });
	});

	it("baut Pflicht-Objektgruppe address vollständig", () => {
		const value = buildMandatoryGroupValue({
			kind: "group",
			dataStructure: { itemName: "address" },
			collectionType: null,
			minUsage: 1,
			maxUsage: 1,
			items: [
				{
					kind: "field",
					dataStructure: { itemName: "type", default: "V4" },
					fieldType: "string",
					minUsage: 1,
					maxUsage: 1,
				},
				{
					kind: "field",
					dataStructure: { itemName: "ip", default: "192.168.178.42" },
					fieldType: "string",
					minUsage: 1,
					maxUsage: 1,
				},
			],
		} as any);

		expect(value).toEqual({
			type: "V4",
			ip: "192.168.178.42",
		});
	});

	it("baut map-Objektgruppe (minUsage=1) mit Feldern statt {}", () => {
		const value = buildMandatoryGroupValue({
			kind: "group",
			dataStructure: { itemName: "address" },
			collectionType: "map",
			minUsage: 1,
			maxUsage: 1,
			items: [
				{
					kind: "field",
					dataStructure: { itemName: "ip", default: "10.0.0.1" },
					fieldType: "string",
					minUsage: 1,
					maxUsage: 1,
				},
			],
		} as any);

		expect(value).toEqual({ ip: "10.0.0.1" });
	});

	it("legt optionale Array-Gruppe (minUsage=0) nicht an", () => {
		const defaults = buildDefaultsFromSchemaItems([
			{
				kind: "field",
				dataStructure: { itemName: "protocol", default: "IP" },
				fieldType: "string",
				minUsage: 1,
				maxUsage: 1,
			},
			{
				kind: "group",
				dataStructure: { itemName: "versions" },
				collectionType: "array",
				minUsage: 0,
				maxUsage: 10,
				items: [],
			},
		] as any);

		expect(defaults.protocol).toBe("IP");
		expect(defaults.versions).toBeUndefined();
	});

	it("legt optionale verschachtelte Gruppe in Array-Eintrag nicht an", () => {
		const entry = buildDefaultEntryFromSchemaItems([
			{
				kind: "field",
				dataStructure: { itemName: "type", default: "V4" },
				fieldType: "string",
				minUsage: 1,
				maxUsage: 1,
			},
			{
				kind: "group",
				dataStructure: { itemName: "tags" },
				collectionType: "array",
				minUsage: 0,
				maxUsage: 5,
				items: [],
			},
		] as any);

		expect(entry).toEqual({ type: "V4" });
	});

	it("baut verschachtelte map-Gruppe address auch neben Top-Level-Feld type", () => {
		const defaults = buildDefaultsFromSchemaItems([
			{
				kind: "field",
				dataStructure: { itemName: "type", default: "IP" },
				fieldType: "string",
				minUsage: 1,
				maxUsage: 1,
			},
			{
				kind: "group",
				dataStructure: { itemName: "address" },
				collectionType: "map",
				minUsage: 1,
				maxUsage: 1,
				items: [
					{
						kind: "field",
						dataStructure: { itemName: "type", default: "V4" },
						fieldType: "string",
						minUsage: 1,
						maxUsage: 1,
					},
					{
						kind: "field",
						dataStructure: { itemName: "ip", default: "10.0.0.1" },
						fieldType: "string",
						minUsage: 1,
						maxUsage: 1,
					},
				],
			},
		] as any);

		expect(defaults.address).toEqual({ type: "V4", ip: "10.0.0.1" });
	});
});
