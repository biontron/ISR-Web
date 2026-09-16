import { placeFixedHoverOverlay, resolveGraphNodeHoverFields } from "./graphNodeHover";

describe("placeFixedHoverOverlay", () => {
	const overlay = { width: 320, height: 240 };
	const viewport = { width: 1000, height: 800 };

	it("legt das Menü rechts neben den Knoten", () => {
		expect(
			placeFixedHoverOverlay({
				anchor: { left: 100, top: 120, right: 220, width: 120, height: 40 },
				overlay,
				viewport,
			})
		).toEqual({ left: 228, top: 120 });
	});

	it("klappt nach links, wenn rechts kein Platz ist", () => {
		expect(
			placeFixedHoverOverlay({
				anchor: { left: 800, top: 100, right: 960, width: 160, height: 40 },
				overlay,
				viewport,
			})
		).toEqual({ left: 472, top: 100 });
	});

	it("schiebt das Menü ins Fenster, wenn es unten rausragen würde", () => {
		expect(
			placeFixedHoverOverlay({
				anchor: { left: 40, top: 700, right: 160, width: 120, height: 40 },
				overlay,
				viewport,
			})
		).toEqual({ left: 168, top: 552 });
	});

	it("hält den linken und oberen Rand ein", () => {
		expect(
			placeFixedHoverOverlay({
				anchor: { left: 4, top: 2, right: 40, width: 36, height: 20 },
				overlay: { width: 990, height: 790 },
				viewport,
			})
		).toEqual({ left: 8, top: 8 });
	});
});

describe("resolveGraphNodeHoverFields", () => {
	const root = {
		assets: {
			assets: [
				{
					id: "a-1",
					class: "Asset",
					status: "untouched",
					environmentId: "office",
					definition: {
						baseType: "COMPONENT",
						type: "DEVICE",
						name: "Notebook",
						label: "NB-01",
					},
				},
			],
		},
		groups: { groups: [] as { id: string }[] },
		views: { views: [] as { id: string }[] },
		environments: {
			findById: (id: string) =>
				id === "office" ? { id: "office", definition: { name: "Office" } } : undefined,
		},
	};

	it("liefert Hover-Felder für ein Graph-Asset", () => {
		expect(resolveGraphNodeHoverFields(root, "a-1")).toEqual({
			id: "a-1",
			environmentId: "office",
			environment: "Office",
			baseType: "COMPONENT",
			type: "DEVICE",
			subType: undefined,
			name: "Notebook",
			label: "NB-01",
			description: undefined,
			status: "untouched",
			className: "Asset",
		});
	});

	it("ignoriert Layout-Knoten ohne Element", () => {
		expect(resolveGraphNodeHoverFields(root, "swimlane-spacer")).toBeUndefined();
	});
});
