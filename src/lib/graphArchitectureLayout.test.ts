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
	it("liest ein Rechteck A5:D6", () => {
		expect(parseRange("A5:D6")).toEqual({ c1: 0, r1: 4, c2: 3, r2: 5 });
		expect(parseRange("c1")).toEqual({ c1: 2, r1: 0, c2: 2, r2: 0 });
	});

	it("erkennt einen Rahmen über inneren Blöcken", () => {
		const outer = parseRange("A1:B2");
		const inner = parseRange("B2");
		expect(outer && inner && rangeCovers(outer, inner)).toBe(true);
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
		expect(collapsed[0].fromY).toBeCloseTo(bike.y + bike.height / 2);
	});
});
