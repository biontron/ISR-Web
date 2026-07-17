import { DEFAULT_GRAPH_CONFIG, loadGraphConfig, resolveContainerPreset, resolveSwimlaneForTags, resolveSwimlaneLabel, resolveUngroupedSwimlane } from "./graphConfig";

describe("graphConfig", () => {
	it("migrates legacy MAIN container preset", () => {
		const preset = resolveContainerPreset(DEFAULT_GRAPH_CONFIG, "MAIN");
		expect(preset.fill).toBe("#fff8dc");
		expect(preset.type).toBe("CONTAINER");
	});

	it("falls back to containerDefault", () => {
		const preset = resolveContainerPreset(DEFAULT_GRAPH_CONFIG, "UNKNOWN");
		expect(preset.fill).toBe("#f5f5f5");
	});

	it("matches swimlane tags", () => {
		const config = {
			...DEFAULT_GRAPH_CONFIG,
			swimlanes: [
				{ id: "prod", label: "Production", tags: ["#prod"] },
				{ id: "db", label: "Databases", tags: ["database"] },
				{ id: "ungrouped", label: "Other", tags: [] },
			],
		};
		expect(resolveSwimlaneForTags(config, ["#prod"]).id).toBe("prod");
		expect(resolveSwimlaneForTags(config, ["#database"]).id).toBe("db");
		expect(resolveSwimlaneForTags(config, ["database"]).id).toBe("db");
		expect(resolveSwimlaneForTags(config, ["#other"]).id).toBe("ungrouped");
	});

	it("liefert ungrouped als Fallback-Lane", () => {
		expect(resolveUngroupedSwimlane(DEFAULT_GRAPH_CONFIG).id).toBe("ungrouped");
	});

	it("fällt auf Default-Swimlanes zurück wenn Override leer ist", () => {
		const config = loadGraphConfig({ swimlanes: [] });
		expect(config.swimlanes.length).toBeGreaterThan(0);
		expect(config.swimlanes[0].id).toBe(DEFAULT_GRAPH_CONFIG.swimlanes[0].id);
	});

	it("löst mehrsprachige Swimlane-Titel auf", () => {
		const lane = {
			id: "db",
			label: { und: "Databases", de: "Datenbanken" },
			tags: ["database"],
		};
		expect(resolveSwimlaneLabel(lane, "de")).toBe("Datenbanken");
		expect(resolveSwimlaneLabel(lane, "en")).toBe("Databases");
		expect(resolveSwimlaneLabel({ ...lane, label: "Plain" }, "de")).toBe("Plain");
	});
});
