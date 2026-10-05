import { DEFAULT_GRAPH_CONFIG, loadGraphConfig, resolveContainerPreset, resolveSwimlaneForTags, resolveSwimlaneLabel, resolveUngroupedSwimlane } from "./graphConfig";
import { readGraphArchitectures, resolveGraphConfigForView } from "./graphViewModel";
import { layoutArchitecture } from "./graphArchitectureLayout";
import { EnvironmentModel, environmentRestProperties } from "../Stores/Models/Environment.Model";

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

	it("zeigt keine Architektur, solange sie nicht konfiguriert ist", () => {
		expect(
			DEFAULT_GRAPH_CONFIG.representations?.some((entry) => entry.kind === "architecture")
		).toBe(false);
		const config = resolveGraphConfigForView(undefined);
		expect(config.representations?.filter((entry) => entry.kind === "architecture")).toEqual([]);
		expect(config.representations?.filter((entry) => entry.kind === "swimlane").map((entry) => entry.id)).toEqual([
			"Clients",
			"Services",
			"Databases",
		]);
	});

	it("liest Architekturen aus der Umgebung, Swimlanes bleiben aus der Konfiguration", () => {
		const environmentArchitecture = {
			kind: "architecture" as const,
			id: "env-arch",
			label: "Umgebung",
			blocks: [],
		};
		const config = resolveGraphConfigForView(
			{
				get: () => ({
					representations: [
						{
							kind: "architecture",
							id: "view-arch",
							label: "View",
							blocks: [],
						},
					],
				}),
			},
			{
				environments: [
					{
						properties: {
							graph: { representations: [environmentArchitecture] },
						},
					},
				],
			}
		);
		const architectures = config.representations?.filter((entry) => entry.kind === "architecture") ?? [];
		expect(architectures.map((entry) => entry.id)).toEqual(["env-arch"]);
		expect(config.representations?.filter((entry) => entry.kind === "swimlane").map((entry) => entry.id)).toEqual([
			"Clients",
			"Services",
			"Databases",
		]);
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

	it("übernimmt die Environment-Architektur mit leeren Server-Feldern", () => {
		const graph = {
			representations: [
				{
					kind: "architecture",
					id: "zielarchitektur",
					label: "Zielarchitektur",
					rowBands: [{ label: "Experience", range: "A1:A2" }],
					blocks: [
						{
							id: "region-experience",
							role: "region",
							range: "A1:K2",
							label: null,
							fill: "#d9e8f6",
							dashed: false,
							header: "",
							architectureId: "",
							labelColor: "",
							align: "",
							shape: "",
							tags: [],
							previewMembers: [],
						},
						{
							id: "core-services",
							role: "node",
							range: "A5:D6",
							label: "Core Services API",
							fill: "#d6e6fa",
							dashed: false,
							header: "",
							architectureId: "core-services-detail",
							labelColor: "",
							align: "",
							shape: "",
							tags: [],
							previewMembers: [],
						},
						{
							id: "db-leasy",
							role: "node",
							range: "G9",
							label: "",
							fill: "#b0bec5",
							shape: "cylinder",
							align: "",
							architectureId: "",
							labelColor: "",
						},
					],
					edges: [{ from: "core-services", to: "db-leasy", bidirectional: false }],
				},
				{
					kind: "architecture",
					id: "core-services-detail",
					label: "Core Services API",
					rowBands: [],
					blocks: [],
					edges: [],
				},
			],
		};
		const environment = EnvironmentModel.create({
			id: "01e93fa0-1c74-44b1-bafd-6d8a988fea01",
			definition: { baseType: "ENVIRONMENT", subType: "null", name: "Intern" },
			properties: {
				bgColor: "#FF6611",
				responsibles: [],
				notations: [],
				ignoredDevices: [],
				graph,
			},
		});
		const config = resolveGraphConfigForView(undefined, { environments: [environment] });
		expect(readGraphArchitectures(environment.properties.graph).map((entry) => entry.id)).toEqual([
			"zielarchitektur",
			"core-services-detail",
		]);
		expect(
			config.representations?.filter((entry) => entry.kind === "architecture").map((entry) => entry.id)
		).toEqual(["zielarchitektur", "core-services-detail"]);
		const layout = layoutArchitecture(readGraphArchitectures(environment.properties.graph)[0]);
		expect(layout.errors).toEqual([]);
		expect(layout.placed.map((item) => item.block.id)).toEqual([
			"region-experience",
			"core-services",
			"db-leasy",
		]);
		expect(environmentRestProperties(environment).graph).toBe(environment.properties.graph);
		expect(environmentRestProperties(environment)).toMatchObject({
			bgColor: "#FF6611",
			responsibles: [],
			notations: [],
		});
	});
});
