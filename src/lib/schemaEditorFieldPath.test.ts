import {
	buildSchemaEditorMstPath,
	buildSchemaEditorSchemaPath,
} from "./schemaEditorFieldPath";

describe("schemaEditorFieldPath", () => {
	it("buildSchemaEditorSchemaPath hängt itemName ohne MST-Mapping an", () => {
		expect(buildSchemaEditorSchemaPath("", "", "")).toBe("");
		expect(buildSchemaEditorSchemaPath("", "", "definition")).toBe("definition");
		expect(buildSchemaEditorSchemaPath("docks[0].dockparts[1]", "", "protocol")).toBe(
			"docks[0].dockparts[1].protocol"
		);
		expect(
			buildSchemaEditorSchemaPath(
				"docks[0].dockparts[1]",
				"docks[0].dockparts[1].address",
				"ip"
			)
		).toBe("docks[0].dockparts[1].address.ip");
	});

	it("buildSchemaEditorMstPath mappt schema-Felder auf settings", () => {
		expect(
			buildSchemaEditorMstPath(
				"docks[0].dockparts[1]",
				"docks[0].dockparts[1].address",
				"ip"
			)
		).toBe("docks[0].dockparts[1].settings.address.ip");
	});

	it("buildSchemaEditorMstPath für flache Connection links[n]", () => {
		expect(buildSchemaEditorMstPath("links[0]", "links[0]", "id")).toBe("links[0].id");
		expect(buildSchemaEditorMstPath("links[0]", "links[0]", "title")).toBe("links[0].title");
		expect(
			buildSchemaEditorMstPath("links[0]", "links[0].linkparts[0]", "fromDockpartRef")
		).toBe("links[0].linkparts[0].fromDockpartRef");
	});
});
