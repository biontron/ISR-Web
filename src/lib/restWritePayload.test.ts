import { restWritePayloadForAsset, restWritePayloadForConnection, restWritePayloadForGroup } from "./restWritePayload";

describe("restWritePayloadForConnection", () => {
	it("schreibt nur id/definition/links/settings; UUID-ComponentRef wird zur Dock-ID", () => {
		const payload = restWritePayloadForConnection({
			id: "C-6e10mZt9VAXJVFuVR96yEK",
			environmentId: "01e93fa0-1c74-44b1-bafd-6d8a988fea01",
			kind: "link",
			bridgeId: "",
			peerEnvironmentRef: "",
			peerConnectionRef: "",
			definition: { label: "Neue Verbindung", description: "" },
			links: [
				{
					id: "2",
					title: "Neue Verbindung",
					fromComponentRef: "4b8c402c-87a4-494a-8c40-2c87a4c94a59",
					fromDockRef: "D-A9JN75eH2eAkArEYjr6xAD",
					toComponentRef: "A-0123456789ABCDEFGHIJKL",
					toDockRef: "D-6JR3j27W3ZNDNb5svCNC5Q",
					direction: "DUAL",
				},
			],
			settings: {},
		});
		expect(Object.keys(payload)).toEqual(["id", "definition", "links", "settings"]);
		expect(payload.environmentId).toBeUndefined();
		expect(payload.kind).toBeUndefined();
		const link = (payload.links as Array<Record<string, unknown>>)[0];
		expect(link.fromComponentRef).toBe("D-A9JN75eH2eAkArEYjr6xAD");
		expect(link.toComponentRef).toBe("A-0123456789ABCDEFGHIJKL");
		expect(link.fromDockRef).toBe("D-A9JN75eH2eAkArEYjr6xAD");
		expect(link.toDockRef).toBe("D-6JR3j27W3ZNDNb5svCNC5Q");
	});

	it("nimmt die aktuelle Dock-ID, wenn fromComponentRef eine andere Dock-ID ist", () => {
		const payload = restWritePayloadForConnection({
			id: "C-6e10mZt9VAXJVFuVR96yEK",
			definition: { label: "Neue Verbindung", description: "" },
			links: [
				{
					id: "2",
					fromComponentRef: "D-A9JN75eH2eAkArEYjr6xAD",
					fromDockRef: "D-6JR3j27W3ZNDNb5svCNC5Q",
					toComponentRef: "D-6JR3j27W3ZNDNb5svCNC5Q",
					toDockRef: "D-6JR3j27W3ZNDNb5svCNC5Q",
					direction: "DUAL",
				},
			],
			settings: {},
		});
		const link = (payload.links as Array<Record<string, unknown>>)[0];
		expect(link.fromComponentRef).toBe("D-6JR3j27W3ZNDNb5svCNC5Q");
		expect(link.toComponentRef).toBe("D-6JR3j27W3ZNDNb5svCNC5Q");
	});
});

describe("restWritePayloadForAsset", () => {
	it("stellt ownerIdRef direkt hinter definition; environmentId folgt danach", () => {
		const payload = restWritePayloadForAsset({
			id: "A-1M1BSTBv3zKbWBJ8LSYITg",
			environmentId: "01e93fa0-1c74-44b1-bafd-6d8a988fea01",
			definition: {
				storeType: "COMPONENT",
				baseType: "COMPONENT",
				type: "HARDWARE",
				name: "Neu",
				label: "Neue Komponente",
			},
			ownerIdRef: "4b8c402c-87a4-494a-8c40-2c87a4c94a59",
			docks: [],
			attachments: [],
			properties: { style: { bgColor: "", graph: { layout: null } } },
			settings: { dns: { dn: { names: "supergut" } } },
			elementIdRefs: [
				{
					environmentId: "01e93fa0-1c74-44b1-bafd-6d8a988fea01",
					id: "A-other",
					baseType: "COMPONENT",
					type: "HARDWARE",
					subType: "",
					name: "Andere",
					label: "Andere Komponente",
				},
			],
			filterRules: [],
		});
		expect(Object.keys(payload).slice(0, 4)).toEqual([
			"id",
			"definition",
			"ownerIdRef",
			"environmentId",
		]);
		expect(payload.environmentId).toBe("01e93fa0-1c74-44b1-bafd-6d8a988fea01");
		expect(payload.ownerIdRef).toBe("4b8c402c-87a4-494a-8c40-2c87a4c94a59");
		expect(payload.elementIdRefs).toEqual([
			{
				environmentId: "01e93fa0-1c74-44b1-bafd-6d8a988fea01",
				id: "A-other",
				baseType: "COMPONENT",
				type: "HARDWARE",
				subType: "",
				name: "Andere",
				label: "Andere Komponente",
			},
		]);
		expect(payload.settings).toEqual({ dns: { dn: { names: "supergut" } } });
	});

	it("schreibt Dockpart-version, nicht versions[]", () => {
		const payload = restWritePayloadForAsset({
			id: "A-1M1BSTBv3zKbWBJ8LSYITg",
			environmentId: "01e93fa0-1c74-44b1-bafd-6d8a988fea01",
			definition: {
				storeType: "COMPONENT",
				baseType: "COMPONENT",
				type: "HARDWARE",
				name: "Neu",
				label: "Neue Komponente",
			},
			docks: [
				{
					id: "D-A9JN75eH2eAkArEYjr6xAD",
					dockparts: [
						{
							id: "1",
							type: "IP",
							version: "4",
							versions: [{ version: "4" }],
						},
					],
				},
			],
		});
		const part = (payload.docks as Array<{ dockparts: Array<Record<string, unknown>> }>)[0]
			.dockparts[0];
		expect(part.version).toBe("4");
		expect(part.versions).toBeUndefined();
	});
});

describe("restWritePayloadForGroup", () => {
	it("schreibt keine docks und keine Store-Felder", () => {
		const payload = restWritePayloadForGroup({
			id: "G-test",
			definition: {
				storeType: "VIEWGROUP",
				baseType: "GROUP",
				type: "AREA",
				name: "Ort",
				label: "Ort",
			},
			parentIdRef: "view1",
			elementIdRefs: [
				{
					environmentId: "env-1",
					id: "A-1",
					baseType: "COMPONENT",
					type: "DEVICE",
					subType: "",
					name: "Device",
					label: "Device",
				},
			],
			filterRules: [{ xpath: "definition/type='DEVICE'", description: "", activated: true, environments: [{ ref: "env-1" }] }],
			attachments: [],
			properties: { style: { bgColor: null, graph: { layout: null } } },
			settings: {},
			docks: [{ id: "should-not-be-sent", dockparts: [] }],
			status: "changed",
		});
		expect(Object.keys(payload)).toEqual([
			"id",
			"definition",
			"parentIdRef",
			"elementIdRefs",
			"filterRules",
			"attachments",
			"properties",
			"settings",
		]);
		expect(payload.docks).toBeUndefined();
		expect(payload.status).toBeUndefined();
	});
});
