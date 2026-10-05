import type { GraphArchitectureRepresentation, GraphCellBlock } from "./graphConfig";

function node(
	id: string,
	range: string,
	label: string,
	fill: string,
	extra?: Partial<GraphCellBlock>
): GraphCellBlock {
	return { id, range, label, fill, role: "node", ...extra };
}

function preview(name: string): { id: string; label: string }[] {
	return [
		{ id: `${name}-svc-1`, label: `${name} Service A` },
		{ id: `${name}-svc-2`, label: `${name} Service B` },
	];
}

/** Beispiel aus dem Zielbild, nur für Layout-Tests. Der Graph liest Architekturen aus den Environment-Einstellungen. */
export const EXAMPLE_TARGET_ARCHITECTURE: GraphArchitectureRepresentation = {
	kind: "architecture",
	id: "zielarchitektur",
	label: "Zielarchitektur",
	rowBands: [
		{ label: "Experience", range: "A1:A2" },
		{ label: "Integration", range: "A3:A6" },
		{ label: "Business", range: "A7:A9" },
		{ label: "Legacy", range: "E7:E9" },
	],
	blocks: [
		{ id: "region-experience", role: "region", range: "A1:K2", fill: "#d9e8f6" },
		{ id: "region-integration", role: "region", range: "A3:K6", fill: "#fff3d6" },
		{ id: "region-business", role: "region", range: "A7:D9", fill: "#e5f6e8" },
		{ id: "region-legacy", role: "region", range: "E7:K9", fill: "#fde8ea" },
		{ id: "region-channel", role: "region", range: "L1:M9", fill: "#fde8ea" },
		{
			id: "frame-antrag",
			role: "frame",
			range: "A1:B2",
			dashed: true,
			header: "Mitarbeiter · Web User",
		},
		{ id: "frame-bike", role: "frame", range: "C1:C2", dashed: true, header: "Web User · Bike" },
		{ id: "frame-xyz", role: "frame", range: "D1:D2", dashed: true, header: "Web User · Xyz" },
		{ id: "frame-api-antrag", role: "frame", range: "A3:B3", dashed: true, header: "Externe Schnittstelle" },
		{ id: "frame-api-bike", role: "frame", range: "C3:C3", dashed: true },
		{ id: "frame-api-xyz", role: "frame", range: "D3:D3", dashed: true },
		node("antrag-ui", "A1", "Internes Antragsw. UI", "#c8e6c9", { previewMembers: preview("Antrag") }),
		node("makler-ui", "B1", "Makler Web UI", "#c8e6c9", { previewMembers: preview("Makler") }),
		node("bike-ui", "C1", "Bike Web UI", "#c8e6c9", { previewMembers: preview("Bike"), tags: ["bike"] }),
		node("xyz-ui", "D1", "Xyz Web UI", "#c8e6c9", { previewMembers: preview("Xyz") }),
		node("ebox-ui", "L1", "eBox UI", "#c8e6c9", { previewMembers: preview("eBox") }),
		node("pos-ui", "M1", "POS UI", "#c8e6c9", { previewMembers: preview("POS") }),
		node("antrag-flow", "A2", "Antragswesen Workflow", "#ef9a9a"),
		node("makler-flow", "B2", "Makler Workflow", "#ef9a9a"),
		node("bike-flow", "C2", "Bike Workflow", "#ef9a9a"),
		node("xyz-flow", "D2", "Xyz Workflow", "#ef9a9a"),
		node("antrag-api", "A3", "Antragswesen API", "#90caf9", { previewMembers: preview("Antrag API") }),
		node("makler-api", "B3", "Makler API", "#90caf9"),
		node("bike-api", "C3", "Bike API", "#90caf9", { tags: ["bike"] }),
		node("xyz-api", "D3", "Xyz API", "#90caf9"),
		node("ifc-antrag", "E3", "IFC", "#80deea"),
		node("ifc-bike", "G3", "IFC", "#80deea"),
		node("ifc-xyz", "I3", "IFC", "#80deea"),
		node("adapter-antrag", "A4", "Adapter", "#eeeeee"),
		node("adapter-makler", "B4", "Adapter", "#eeeeee"),
		node("adapter-bike", "C4", "Adapter", "#eeeeee"),
		node("adapter-xyz", "D4", "Adapter", "#eeeeee"),
		node("core-services", "A5:D6", "Core Services API", "#d6e6fa", {
			architectureId: "core-services-detail",
			previewMembers: preview("Core"),
		}),
		node("interface-contract", "E5:F6", "Interface Contract", "#4dd0e1", { align: "center" }),
		node("orchestration", "G5:K6", "Prozess Orchestration", "#1565c0", { labelColor: "#ffffff" }),
		node("presentation-a", "A7:B7", "Presentation Workflow", "#ef9a9a"),
		node("presentation-b", "C7:D7", "Presentation Workflow", "#ef9a9a"),
		node("intern-a", "A8:B8", "Internes UI A", "#c8e6c9", { previewMembers: preview("Intern A") }),
		node("intern-b", "C8:D8", "Internes UI B", "#c8e6c9"),
		node("egecko", "E8", "Egecko Finance", "#f8d0d4"),
		node("enaio", "F8", "Enaio (DMS)", "#f8d0d4"),
		node("leasysoft", "G8", "LeasySoft", "#f8d0d4", { tags: ["leasy"], previewMembers: preview("Leasy") }),
		node("ebox", "H8", "eBox", "#f8d0d4"),
		node("pos", "I8", "POS", "#f8d0d4"),
		node("db-egecko", "E9", "", "#b0bec5", { shape: "cylinder" }),
		node("db-enaio", "F9", "", "#b0bec5", { shape: "cylinder" }),
		node("db-leasy", "G9", "", "#b0bec5", { shape: "cylinder" }),
	],
	edges: [
		{ from: "adapter-antrag", to: "interface-contract" },
		{ from: "adapter-makler", to: "interface-contract" },
		{ from: "adapter-bike", to: "orchestration" },
		{ from: "adapter-xyz", to: "orchestration" },
		{ from: "core-services", to: "orchestration", bidirectional: true },
		{ from: "orchestration", to: "egecko" },
		{ from: "orchestration", to: "enaio" },
		{ from: "orchestration", to: "leasysoft" },
		{ from: "orchestration", to: "ebox" },
		{ from: "orchestration", to: "pos" },
		{ from: "intern-a", to: "core-services" },
		{ from: "intern-b", to: "core-services" },
		{ from: "ebox-ui", to: "ebox" },
		{ from: "pos-ui", to: "pos" },
	],
};

export const EXAMPLE_CORE_ARCHITECTURE: GraphArchitectureRepresentation = {
	kind: "architecture",
	id: "core-services-detail",
	label: "Core Services API",
	blocks: [
		{ id: "region-core", role: "region", range: "A1:C2", fill: "#eef5ff" },
		node("openapi", "A1", "OpenAPI", "#90caf9", { previewMembers: preview("OpenAPI") }),
		node("events", "B1", "Events", "#90caf9", { previewMembers: preview("Events") }),
		node("versioning", "C1", "Versionierung", "#90caf9"),
		node("contracts", "A2:C2", "API Contracts", "#d6e6fa"),
	],
	edges: [
		{ from: "openapi", to: "contracts" },
		{ from: "events", to: "contracts" },
		{ from: "versioning", to: "contracts" },
	],
};

export const EXAMPLE_ARCHITECTURES: GraphArchitectureRepresentation[] = [
	EXAMPLE_TARGET_ARCHITECTURE,
	EXAMPLE_CORE_ARCHITECTURE,
];
