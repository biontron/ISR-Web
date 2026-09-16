import { GRAPH_MAX_TREE_DEPTH, resolveGraphTreeDepth } from "./graphTreeLimits";

describe("resolveGraphTreeDepth", () => {
	it("View-Übersicht geht bis zur angeforderten Tiefe (Groups + Kinder)", () => {
		expect(resolveGraphTreeDepth(10)).toBe(GRAPH_MAX_TREE_DEPTH);
	});

	it("begrenzt auf 10 und nicht unter 0", () => {
		expect(resolveGraphTreeDepth(99)).toBe(10);
		expect(resolveGraphTreeDepth(-3)).toBe(0);
	});
});
