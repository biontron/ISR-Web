import { EXAMPLE_TARGET_ARCHITECTURE } from "./graphArchitectureExample";
import {
	assignMembersToBlocks,
	layoutArchitecture,
	parseRange,
	rangeCovers,
	visibleArchitectureEdges,
} from "./graphArchitectureLayout";
import type { GraphCellBlock } from "./graphConfig";

describe("graphArchitectureLayout", () => {
	it("lässt die Workflow Engine in der Öffnung eines C-Blocks zu", () => {
		const layout = layoutArchitecture({
			kind: "architecture",
			id: "c-form",
			label: "C",
			blocks: [
				{
					id: "core-services",
					role: "node",
					range: "A5:I7",
					shape: "c",
					label: "Core Services API",
					fill: "#d6e6fa",
				},
				{ id: "interface-contract", role: "node", range: "E6:F6", label: "Interface Contract" },
				{ id: "orchestration", role: "node", range: "G6:K6", label: "Prozess Orchestration" },
			],
		});
		expect(layout.errors).toEqual([]);
		const core = layout.placed.find((item) => item.block.id === "core-services");
		const engine = layout.placed.find((item) => item.block.id === "orchestration");
		if (!core || !engine) {
			throw new Error("C oder Engine fehlt");
		}
		expect(engine.x).toBeGreaterThan(core.x);
		expect(engine.x).toBeLessThan(core.x + core.width);
		expect(engine.x + engine.width).toBeGreaterThan(core.x + core.width);
	});

	it("liest ein Rechteck A5:D6", () => {
		expect(parseRange("A5:D6")).toEqual({ c1: 0, r1: 4, c2: 3, r2: 5 });
		expect(parseRange("c1")).toEqual({ c1: 2, r1: 0, c2: 2, r2: 0 });
	});

	it("erkennt einen Rahmen über inneren Blöcken", () => {
		const outer = parseRange("A1:B2");
		const inner = parseRange("B2");
		expect(outer && inner && rangeCovers(outer, inner)).toBe(true);
	});

	it("liest <tags><tag>bike</tag></tags> als Zuordnung", () => {
		const blocks: GraphCellBlock[] = [
			{
				id: "bike-ui",
				role: "node",
				range: "C1",
				tags: { tag: "bike" } as unknown as string[],
				previewMembers: {
					member: [
						{ id: "Bike-svc-1", label: "Bike Service A" },
						{ id: "Bike-svc-2", label: "Bike Service B" },
					],
				} as unknown as GraphCellBlock["previewMembers"],
			},
			{ id: "bike-api", role: "node", range: "C3", tags: { tag: "bike" } as unknown as string[] },
		];
		const { byBlock, errors } = assignMembersToBlocks(blocks, [
			{ id: "e3e465ee", label: "192.168.39.97", tags: ["bike"] },
		]);
		expect(errors).toEqual([]);
		expect(byBlock.get("bike-ui")?.map((member) => member.id)).toEqual(["e3e465ee"]);
		expect(byBlock.get("bike-api")?.map((member) => member.id)).toEqual(["e3e465ee"]);
	});

	it("ordnet Components per Hashtag einer Box zu", () => {
		const blocks: GraphCellBlock[] = [
			{ id: "bike", role: "node", range: "A1", tags: ["#Bike"] },
			{ id: "other", role: "node", range: "B1", tags: ["api"] },
		];
		const { byBlock, errors } = assignMembersToBlocks(blocks, [
			{ id: "svc-1", label: "Bike Service", tags: ["bike"] },
			{ id: "svc-2", label: "Andere", tags: ["#API"] },
		]);
		expect(errors).toEqual([]);
		expect(byBlock.get("bike")?.map((member) => member.id)).toEqual(["svc-1"]);
		expect(byBlock.get("other")?.map((member) => member.id)).toEqual(["svc-2"]);
	});

	it("legt direkt verlinkte Komponenten in diesen Block und nicht in den Tag-Block", () => {
		const blocks: GraphCellBlock[] = [
			{ id: "linked", role: "node", range: "A1", elementIds: ["svc-1", "svc-2"] },
			{ id: "tagged", role: "node", range: "B1", tags: ["api"] },
		];
		const { byBlock, errors } = assignMembersToBlocks(blocks, [
			{ id: "svc-1", label: "Eins", tags: ["api"] },
			{ id: "svc-2", label: "Zwei", tags: ["api"] },
			{ id: "svc-3", label: "Drei", tags: ["api"] },
		]);
		expect(errors).toEqual([]);
		expect(byBlock.get("linked")?.map((member) => member.id)).toEqual(["svc-1", "svc-2"]);
		expect(byBlock.get("tagged")?.map((member) => member.id)).toEqual(["svc-3"]);
	});

	it("meldet zwei direkte Links auf verschiedene Blöcke", () => {
		const blocks: GraphCellBlock[] = [
			{ id: "a", role: "node", range: "A1", elementIds: ["svc-1"] },
			{ id: "b", role: "node", range: "B1", elementIds: ["svc-1"] },
		];
		const { errors } = assignMembersToBlocks(blocks, [{ id: "svc-1", label: "Eins", tags: [] }]);
		expect(errors[0]).toContain("svc-1");
	});

	it("legt das Integrationsband links neben die Fläche, ohne sie zu überdecken", () => {
		const layout = layoutArchitecture(EXAMPLE_TARGET_ARCHITECTURE);
		const band = layout.bands.find((item) => item.label === "Integration");
		const region = layout.placed.find((item) => item.block.id === "region-integration");
		const legacy = layout.bands.find((item) => item.label === "Legacy");
		const legacyRegion = layout.placed.find((item) => item.block.id === "region-legacy");
		if (!band || !region || !legacy || !legacyRegion) {
			throw new Error("Integrationsband oder Legacy-Fläche fehlt");
		}
		expect(band.x + band.width).toBeLessThanOrEqual(region.x);
		expect(legacy.x + legacy.width).toBeLessThanOrEqual(legacyRegion.x);
		expect(band.width).toBeGreaterThan(0);
		expect(band.fill).toBe("#fff3d6");
	});

	it("rückt jede IFC an den rechten Rand ihrer API", () => {
		const layout = layoutArchitecture(EXAMPLE_TARGET_ARCHITECTURE);
		const beside = (ifcId: string, frameId: string, apiId: string) => {
			const ifc = layout.placed.find((item) => item.block.id === ifcId);
			const frame = layout.placed.find((item) => item.block.id === frameId);
			const api = layout.placed.find((item) => item.block.id === apiId);
			if (!ifc || !frame || !api) {
				throw new Error(ifcId);
			}
			expect(ifc.x).toBeGreaterThan(api.x);
			expect(ifc.x).toBeGreaterThanOrEqual(frame.x);
			expect(ifc.x + ifc.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
		};
		beside("ifc-antrag", "frame-api-antrag", "makler-api");
		beside("ifc-bike", "frame-api-bike", "bike-api");
		beside("ifc-xyz", "frame-api-xyz", "xyz-api");
		expect(layout.placed.find((item) => item.block.id === "region-experience")?.block.header).toBe(
			"Externe Systeme / Portale / AI-Agenten"
		);
		expect(layout.placed.find((item) => item.block.id === "region-legacy")?.block.header).toBe(
			"Altsysteme (Legacy)"
		);
		expect(layout.placed.find((item) => item.block.id === "frame-antrag")?.block.label).toBe("Makler Portal");
		expect(layout.placed.find((item) => item.block.id === "frame-bike")?.block.label).toBe("Bike Portal");
		expect(layout.placed.find((item) => item.block.id === "frame-xyz")?.block.label).toBe("Portal XYZ");
		expect(layout.lineLabels.map((label) => label.label)).toEqual(
			expect.arrayContaining(["Mitarbeiter", "Web User"])
		);
	});

	it("setzt den Contract in der hohen Zelle mittig und meldet keine Überlappung im Beispiel", () => {
		const layout = layoutArchitecture(EXAMPLE_TARGET_ARCHITECTURE);
		expect(layout.errors).toEqual([]);
		const contract = layout.placed.find((item) => item.block.id === "interface-contract");
		const core = layout.placed.find((item) => item.block.id === "core-services");
		if (!contract || !core) {
			throw new Error("Core Services oder Interface Contract fehlt");
		}
		expect(contract.height).toBeLessThan(core.height);
		expect(contract.y).toBeGreaterThan(core.y);
	});

	it("zeichnet eine Kante zwischen sichtbaren Blöcken", () => {
		const layout = layoutArchitecture(EXAMPLE_TARGET_ARCHITECTURE);
		const edges = visibleArchitectureEdges(
			layout.placed,
			[{ from: "adapter-bike", to: "orchestration" }],
			[],
			new Map(),
			new Set()
		);
		expect(edges).toHaveLength(1);
		expect(edges[0].fromY).toBeLessThan(edges[0].toY);
	});

	it("endet eine Connection am Rahmen, solange der Block zugeklappt ist", () => {
		const layout = layoutArchitecture(EXAMPLE_TARGET_ARCHITECTURE);
		const collapsed = visibleArchitectureEdges(
			layout.placed,
			[],
			[{ fromId: "bike-svc", toId: "core-svc" }],
			new Map([
				["bike-svc", "bike-ui"],
				["core-svc", "core-services"],
			]),
			new Set()
		);
		expect(collapsed).toHaveLength(1);
		const bike = layout.placed.find((item) => item.block.id === "bike-ui")!;
		expect(collapsed[0].fromY).toBeCloseTo(bike.y + bike.height);
	});
});
