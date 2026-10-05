import "../Stores/Root.Store";
import { getSnapshot } from "mobx-state-tree";
import { SchemaModel } from "../Stores/Models/Schema.Model";
import { ConnectSchemaModel } from "../Stores/Models/ConnectSchema.Model";
import authStore from "../Stores/Auth.Store";
import { collectTouchedObjects, undoTouchedObject } from "./touchedObjects";
import { buildRestRequestForTouchedObject } from "./restRequestForTouchedObject";
import {
	SchemaSampleParseError,
	countSchemaItems,
	createSchemaPayloadFromSample,
	parseSampleDocument,
	schemaItemsFromValue,
} from "./schemaFromSample";

describe("schemaFromSample", () => {
	it("erzeugt Schema-Editor-Felder und Gruppen aus JSON", () => {
		const parsed = parseSampleDocument(`{
			"id": "web-01",
			"name": { "de": "Web", "en": "Web" },
			"port": 443,
			"enabled": true,
			"note": null,
			"address": { "city": "Berlin" },
			"tags": ["prod", "eu"],
			"links": [{ "id": "a", "title": "Start" }, { "id": "b" }]
		}`);

		expect(parsed.format).toBe("json");
		expect(parsed.suggestedId).toBe("WEB-01");

		const items = schemaItemsFromValue(parsed.value);
		expect(items.map((item) => item.dataStructure.itemName)).toEqual([
			"id",
			"name",
			"port",
			"enabled",
			"note",
			"address",
			"tags",
			"links",
		]);

		const name = items[1];
		expect(name).toMatchObject({ kind: "field", fieldType: "string", example: "Web" });

		const address = items.find((item) => item.dataStructure.itemName === "address");
		expect(address).toMatchObject({
			kind: "group",
			collectionType: "map",
			minUsage: 1,
			maxUsage: 1,
		});

		const tags = items.find((item) => item.dataStructure.itemName === "tags");
		expect(tags).toMatchObject({ kind: "group", collectionType: "array" });
		if (tags?.kind === "group") {
			expect(tags.items[0]).toMatchObject({
				kind: "field",
				dataStructure: { itemName: "value" },
				fieldType: "string",
				example: "prod",
			});
		}

		const links = items.find((item) => item.dataStructure.itemName === "links");
		if (links?.kind === "group") {
			expect(links.items.map((item) => [item.dataStructure.itemName, item.minUsage])).toEqual([
				["id", 1],
				["title", 0],
			]);
		}

		const note = items.find((item) => item.dataStructure.itemName === "note");
		expect(note).toMatchObject({
			kind: "field",
			fieldType: "string",
			itemFlags: { nullable: true },
		});
	});

	it("liest eine XML-Struktur und schlägt die Schema-ID vom Wurzelelement vor", () => {
		const parsed = parseSampleDocument(`
			<server name="web">
				<port>443</port>
				<enabled>true</enabled>
				<tag>prod</tag>
				<tag>eu</tag>
			</server>
		`);
		expect(parsed.format).toBe("xml");
		expect(parsed.suggestedId).toBe("SERVER");
		expect(parsed.value).toEqual({
			name: "web",
			port: 443,
			enabled: true,
			tag: ["prod", "eu"],
		});

		const items = schemaItemsFromValue(parsed.value);
		expect(items.find((item) => item.dataStructure.itemName === "name")).toMatchObject({
			kind: "field",
			fieldType: "string",
		});
		expect(items.find((item) => item.dataStructure.itemName === "port")).toMatchObject({
			fieldType: "number",
		});
	});

	it("behält XML-Namespaces und verschachtelt Gruppen getrennt", () => {
		const parsed = parseSampleDocument(`
<root xmlns:h="http://www.w3.org/TR/html4/"
xmlns:f="https://www.w3schools.com/furniture">
<h:table>
  <h:tr>
    <h:td>Apples</h:td>
    <h:td>Bananas</h:td>
  </h:tr>
</h:table>
<f:table>
  <f:name>African Coffee Table</f:name>
  <f:width>80</f:width>
  <f:length>120</f:length>
</f:table>
</root>
		`);
		expect(parsed.value).toEqual({
			"xmlns:h": "http://www.w3.org/TR/html4/",
			"xmlns:f": "https://www.w3schools.com/furniture",
			"h:table": {
				"h:tr": {
					"h:td": ["Apples", "Bananas"],
				},
			},
			"f:table": {
				"f:name": "African Coffee Table",
				"f:width": 80,
				"f:length": 120,
			},
		});

		const items = schemaItemsFromValue(parsed.value);
		const htmlTable = items.find((item) => item.dataStructure.itemName === "h:table");
		const furnitureTable = items.find((item) => item.dataStructure.itemName === "f:table");
		expect(htmlTable).toMatchObject({ kind: "group", collectionType: "map" });
		expect(furnitureTable).toMatchObject({ kind: "group", collectionType: "map" });
		if (htmlTable?.kind !== "group" || furnitureTable?.kind !== "group") {
			throw new Error("erwartete Gruppen");
		}
		const row = htmlTable.items.find((item) => item.dataStructure.itemName === "h:tr");
		expect(row).toMatchObject({ kind: "group", collectionType: "map" });
		if (row?.kind !== "group") {
			throw new Error("erwartete Zeile");
		}
		expect(row.items.find((item) => item.dataStructure.itemName === "h:td")).toMatchObject({
			kind: "group",
			collectionType: "array",
		});
		expect(furnitureTable.items.map((item) => item.dataStructure.itemName)).toEqual([
			"f:name",
			"f:width",
			"f:length",
		]);
		expect(furnitureTable.items.find((item) => item.dataStructure.itemName === "f:width")).toMatchObject({
			kind: "field",
			fieldType: "number",
		});
	});

	it("liest YAML inklusive Listen, verschachtelter Objekte und Blocktext", () => {
		const parsed = parseSampleDocument(`
id: mail-01
port: 25
tags:
  - inbound
  - relay
address:
  city: Berlin
note: |
  Zeile 1
  Zeile 2
flags: [true, false]
meta: { role: mx }
`);
		expect(parsed.format).toBe("yaml");
		expect(parsed.suggestedId).toBe("MAIL-01");
		expect(parsed.value).toEqual({
			id: "mail-01",
			port: 25,
			tags: ["inbound", "relay"],
			address: { city: "Berlin" },
			note: "Zeile 1\nZeile 2",
			flags: [true, false],
			meta: { role: "mx" },
		});
	});

	it("behandelt ein JSON-Array von Objekten als Felder eines Eintrags", () => {
		const items = schemaItemsFromValue([
			{ id: "a", port: 1 },
			{ id: "b" },
		]);
		expect(items.map((item) => [item.dataStructure.itemName, item.minUsage])).toEqual([
			["id", 1],
			["port", 0],
		]);
	});

	it("legt ein MST-Schema aus der generierten Struktur an", () => {
		const payload = createSchemaPayloadFromSample(
			"SERVER",
			"COMPONENT",
			`{ "name": "web", "ports": [80, 443], "address": { "city": "Berlin" } }`
		);
		const model = SchemaModel.create(payload as never);
		const snapshot = getSnapshot(model);
		expect(snapshot.id).toBe("SERVER");
		expect(snapshot.storeType).toBe("COMPONENT");
		expect(snapshot.items).toHaveLength(3);
		expect(countSchemaItems(schemaItemsFromValue({ name: "web" }))).toBe(1);

		const dockpart = createSchemaPayloadFromSample("LINK", "DOCKPART", "kind: tcp\nport: 443\n");
		expect(getSnapshot(ConnectSchemaModel.create(dockpart as never)).items).toHaveLength(2);
	});

	it("meldet ein neues Schema als Create für die Aktivitätsübersicht", () => {
		const payload = createSchemaPayloadFromSample(
			"SERVER",
			"COMPONENT",
			`{ "name": "web", "port": 443 }`
		);
		const model = SchemaModel.create(payload as never);
		model.setStatus("new");
		const components = [model];
		const root = {
			views: { views: [] },
			groups: { groups: [] },
			assets: { assets: [] },
			connections: { connections: [] },
			configSchemas: {
				internals: [],
				viewgroups: [],
				components,
				dockparts: [],
				removeStagedSchema: (schema: { id: string }) => {
					const index = components.findIndex((item) => item.id === schema.id);
					if (index >= 0) {
						components.splice(index, 1);
					}
				},
			},
		} as any;

		const pending = collectTouchedObjects(root);
		expect(pending).toHaveLength(1);
		expect(pending[0]).toMatchObject({
			id: "SERVER",
			kind: "EditorSchema",
			touch: "create",
			schemaStoreType: "COMPONENT",
		});

		const domain = jest.spyOn(authStore, "getDomain").mockReturnValue("demo");
		try {
			const request = buildRestRequestForTouchedObject(root, pending[0]);
			expect(request.method).toBe("POST");
			expect(request.path).toBe("/demo/config/schema/components/SERVER");
			expect(request.payload).toMatchObject({ id: "SERVER", storeType: "COMPONENT" });
		} finally {
			domain.mockRestore();
		}

		undoTouchedObject(root, pending[0]);
		expect(components).toHaveLength(0);
	});

	it("meldet ungültige Strukturen", () => {
		expect(() => parseSampleDocument("")).toThrow(SchemaSampleParseError);
		expect(() => parseSampleDocument("{")).toThrow(SchemaSampleParseError);
		expect(() => parseSampleDocument("<server>")).toThrow(SchemaSampleParseError);
		expect(() => parseSampleDocument("\tname: web")).toThrow(
			expect.objectContaining({ reason: "tabs" })
		);
		expect(() => parseSampleDocument("name: &id web")).toThrow(
			expect.objectContaining({ reason: "anchor" })
		);
	});
});
