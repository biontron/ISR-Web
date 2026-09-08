import {
	OVERVIEW_DEVICES_PER_ROW,
	packItemsLeftToRightRows,
	stackItemsTopLeft,
} from "./graphOverviewLayout";

describe("graphOverviewLayout", () => {
	it("packt Geräte zeilenweise von links oben nach rechts unten", () => {
		const items = Array.from({ length: 12 }, (_, index) => ({
			id: `d${index}`,
			width: 10,
			height: 8,
		}));
		const packed = packItemsLeftToRightRows(items, OVERVIEW_DEVICES_PER_ROW, 2, 4, 0, 0);

		expect(packed.positions.get("d0")).toEqual({ left: 0, top: 0 });
		expect(packed.positions.get("d9")).toEqual({ left: 9 * 12, top: 0 });
		expect(packed.positions.get("d10")).toEqual({ left: 0, top: 12 });
		expect(packed.positions.get("d11")).toEqual({ left: 12, top: 12 });
		expect(packed.width).toBe(10 * 10 + 9 * 2);
		expect(packed.height).toBe(8 + 4 + 8);
	});

	it("lässt die letzte Zeile linksbündig", () => {
		const items = Array.from({ length: 3 }, (_, index) => ({
			id: `d${index}`,
			width: 20,
			height: 10,
		}));
		const packed = packItemsLeftToRightRows(items, 10, 5, 5, 8, 4);
		expect(packed.positions.get("d0")).toEqual({ left: 8, top: 4 });
		expect(packed.positions.get("d2")).toEqual({ left: 8 + 50, top: 4 });
	});

	it("stapelt Gruppen untereinander an derselben linken Kante", () => {
		const stacked = stackItemsTopLeft(
			[
				{ id: "g1", width: 100, height: 40 },
				{ id: "g2", width: 60, height: 30 },
			],
			10,
			0,
			0
		);
		expect(stacked.positions.get("g1")).toEqual({ left: 0, top: 0 });
		expect(stacked.positions.get("g2")).toEqual({ left: 0, top: 50 });
		expect(stacked.width).toBe(100);
		expect(stacked.height).toBe(80);
	});
});
