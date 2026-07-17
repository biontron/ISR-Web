import { collectTouchedObjects, hasTouchedObjects } from "./touchedObjects";

describe("touchedObjects", () => {
	it("erkennt pending Views, Groups und Assets", () => {
		const root = {
			views: { views: [{ id: "v1", status: "edit", definition: { name: "View A" } }] },
			groups: { groups: [{ id: "g1", status: "changed", definition: { name: "Group B" } }] },
			assets: { assets: [{ id: "a1", status: "new", definition: { name: "Asset C" } }] },
			connections: { connections: [] },
		} as any;

		const pending = collectTouchedObjects(root);
		expect(pending).toHaveLength(3);
		expect(pending.map((p) => p.id)).toEqual(["v1", "g1", "a1"]);
		expect(hasTouchedObjects(root)).toBe(true);
	});

	it("ignoriert untouched Elemente", () => {
		const root = {
			views: { views: [{ id: "v1", status: "untouched", definition: { name: "View" } }] },
			groups: { groups: [] },
			assets: { assets: [] },
			connections: { connections: [] },
		} as any;

		expect(collectTouchedObjects(root)).toEqual([]);
		expect(hasTouchedObjects(root)).toBe(false);
	});

	it("erkennt gelöschte und neue Connections", () => {
		const root = {
			views: { views: [] },
			groups: { groups: [] },
			assets: { assets: [] },
			connections: {
				connections: [
					{ id: "c1", status: "deleted", definition: { name: "Conn D" } },
					{ id: "c2", status: "new", definition: { name: "Conn N" } },
				],
			},
		} as any;

		const pending = collectTouchedObjects(root);
		expect(pending).toHaveLength(2);
		expect(pending.map((p) => p.touch)).toEqual(["delete", "create"]);
	});
});
