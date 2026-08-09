import {
	resolveDockpartSchemaDefinition,
	resolveDockpartSchemaById,
	resolveDockpartEntrySchemaDefinition,
	getAllowedStackParentTypes,
	createEmptyDockpartInstance,
	createNewDockpartSnapshot,
} from "./dockpartSchemaResolve";

describe("dockpartSchemaResolve", () => {
	it("liefert nur eigene Schema-Felder (kein Merge über parent)", () => {
		const generic = {
			id: "GENERIC",
			type: "GENERIC",
			parent: { whitelist: [], blacklist: [] },
			items: [
				{ kind: "field", order: 1, dataStructure: { itemName: "id" }, formProperties: { label: {} } },
				{ kind: "field", order: 4, dataStructure: { itemName: "protocol" }, formProperties: { label: {} } },
			],
		};
		const ipv4 = {
			id: "IPV4",
			type: "IPv4",
			parent: { whitelist: ["GENERIC"], blacklist: [] },
			items: [
				{ kind: "group", order: 10, dataStructure: { itemName: "address" }, formProperties: { label: {} }, items: [] },
			],
		};

		const resolved = resolveDockpartSchemaDefinition(ipv4 as any, [generic, ipv4] as any);
		const names = resolved!.items.map((i) => i.dataStructure.itemName);
		expect(names).not.toContain("id");
		expect(names).not.toContain("protocol");
		expect(names).toContain("address");
	});

	it("parent.whitelist = erlaubte darunterliegende Stack-Typen", () => {
		const ipv4 = {
			id: "IPV4",
			type: "IPv4",
			parent: { whitelist: ["GENERIC"], blacklist: [] },
			items: [],
		};
		expect(getAllowedStackParentTypes(ipv4 as any)).toEqual(["GENERIC"]);
	});

	it("findet Schema per Id oder Type (IPV4 / IPv4)", () => {
		const schemas = [
			{ id: "GENERIC", type: "GENERIC", parent: { whitelist: [], blacklist: [] }, items: [] },
			{ id: "IPV4", type: "IPv4", parent: { whitelist: [], blacklist: [] }, items: [] },
		];
		expect(resolveDockpartSchemaById("GENERIC", schemas as any)?.id).toBe("GENERIC");
		expect(resolveDockpartSchemaById("IPv4", schemas as any)?.id).toBe("IPV4");
		expect(resolveDockpartSchemaById("IPV4", schemas as any)?.type).toBe("IPv4");
	});

	it("resolveDockpartEntrySchemaDefinition nutzt type der Instanz", () => {
		const schemas = [
			{ id: "IPV4", type: "IPv4", parent: { whitelist: [], blacklist: [] }, items: [] },
		];
		expect(
			resolveDockpartEntrySchemaDefinition({ id: "1", type: "IPv4" }, schemas as any)?.id
		).toBe("IPV4");
		expect(resolveDockpartEntrySchemaDefinition({ id: "1" }, schemas as any)).toBeUndefined();
	});

	it("resolveDockpartEntrySchemaDefinition enthält basedOn für den Editor", () => {
		const schemas = [
			{
				id: "GENERIC",
				type: "GENERIC",
				parent: { whitelist: [], blacklist: [] },
				items: [
					{
						kind: "group",
						order: 1,
						dataStructure: { itemName: "basedOn" },
						collectionType: "map",
						minUsage: 1,
						maxUsage: 1,
						items: [],
					},
					{
						kind: "group",
						order: 2,
						dataStructure: { itemName: "address" },
						formProperties: { label: {} },
						items: [],
					},
				],
			},
		];
		const resolved = resolveDockpartEntrySchemaDefinition(
			{ id: "1", type: "GENERIC", basedOn: [] },
			schemas as any
		);
		expect(resolved!.items.map((item) => item.dataStructure.itemName)).toEqual(["basedOn", "address"]);
	});

	it("resolveDockpartEntrySchemaDefinition behält settings-Gruppe für den Editor", () => {
		const schemas = [
			{
				id: "IPV4",
				type: "IPv4",
				parent: { whitelist: [], blacklist: [] },
				items: [
					{
						kind: "field",
						order: 1,
						dataStructure: { itemName: "protocol", default: "IP" },
						fieldType: "string",
						minUsage: 1,
						maxUsage: 1,
					},
					{
						kind: "group",
						order: 2,
						dataStructure: { itemName: "settings" },
						collectionType: "map",
						minUsage: 1,
						maxUsage: 1,
						items: [
							{
								kind: "group",
								order: 1,
								dataStructure: { itemName: "address" },
								items: [],
							},
						],
					},
				],
			},
		] as any;

		const resolved = resolveDockpartEntrySchemaDefinition({ id: "1", type: "IPv4" }, schemas);
		expect(resolved!.items.map((item) => item.dataStructure.itemName)).toEqual([
			"protocol",
			"settings",
		]);
	});

	it("erzeugt Instanz mit Schema-Defaults und type IPv4", () => {
		const schemas = [
			{
				id: "IPV4",
				type: "IPv4",
				parent: { whitelist: [], blacklist: [] },
				items: [
					{
						kind: "field",
						order: 2,
						dataStructure: { itemName: "label", default: "IPv4" },
						formProperties: { label: {} },
						fieldType: "string",
						minUsage: 1,
						maxUsage: 1,
					},
					{
						kind: "field",
						order: 4,
						dataStructure: { itemName: "protocol", default: "IP" },
						formProperties: { label: {} },
						fieldType: "string",
						minUsage: 1,
						maxUsage: 1,
					},
					{
						kind: "group",
						order: 7,
						dataStructure: { itemName: "address" },
						formProperties: { label: {} },
						minUsage: 1,
						maxUsage: 1,
						collectionType: null,
						items: [
							{
								kind: "field",
								order: 2,
								dataStructure: { itemName: "ip", default: "192.168.178.42" },
								formProperties: { label: {} },
								fieldType: "string",
								minUsage: 1,
								maxUsage: 1,
							},
						],
					},
				],
			},
		] as any;

		const empty = createEmptyDockpartInstance("IPV4", schemas);
		expect(empty.type).toBe("IPv4");
		expect(empty.label).toBe("IPv4");
		expect(empty.protocol).toBe("IP");
		expect(empty.address).toEqual({ ip: "192.168.178.42" });

		const created = createNewDockpartSnapshot("IPV4", "99", schemas);
		expect(created.id).toBe("99");
		expect(created.type).toBe("IPv4");
	});

	it("createNewDockpartSnapshot legt nur Dockpart-Root an", () => {
		const schemas = [
			{
				id: "IPV4",
				type: "IPv4",
				parent: { whitelist: [], blacklist: [] },
				items: [
					{
						kind: "group",
						order: 7,
						dataStructure: { itemName: "address" },
						minUsage: 1,
						maxUsage: 1,
						collectionType: "map",
						items: [
							{
								kind: "field",
								order: 2,
								dataStructure: { itemName: "ip", default: "192.168.178.42" },
								fieldType: "string",
								minUsage: 1,
								maxUsage: 1,
							},
						],
					},
				],
			},
		] as any;

		const snapshot = createNewDockpartSnapshot("IPV4", "dp-ipv4", schemas);
		expect(snapshot).toEqual({
			id: "dp-ipv4",
			type: "IPv4",
			label: "IPv4",
			protocol: "",
			versions: [],
			basedOn: [],
			settings: {},
		});
	});
});
