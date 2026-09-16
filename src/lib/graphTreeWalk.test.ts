import { TreeElement } from "../Interfaces/Element";
import { collectPrioritizedGraphWalk } from "./graphTreeWalk";

function asset(id: string, children: TreeElement[] = []): TreeElement {
	return {
		id,
		class: "Asset",
		definition: {
			baseType: "COMPONENT",
			type: "DEVICE",
			name: id,
			label: id,
			description: "",
		},
		children: () => children,
	} as unknown as TreeElement;
}

function group(id: string, children: TreeElement[] = []): TreeElement {
	return {
		id,
		class: "Group",
		definition: {
			baseType: "GROUP",
			type: "AREA",
			name: id,
			description: "",
		},
		children: () => children,
	} as unknown as TreeElement;
}

function view(id: string, children: TreeElement[] = []): TreeElement {
	return {
		id,
		class: "View",
		definition: {
			baseType: "VIEW",
			type: "",
			name: id,
			description: "",
		},
		children: () => children,
	} as unknown as TreeElement;
}

describe("collectPrioritizedGraphWalk", () => {
	it("füllt die letzten View-Folder im Round-Robin statt nur die ersten", () => {
		const tree = view("view1", [
			group("g1", [asset("a1"), asset("a2")]),
			group("g2", [asset("b1"), asset("b2")]),
			group("g3", [asset("c1"), asset("c2")]),
		]);

		const walk = collectPrioritizedGraphWalk(tree, { maxDepth: 10, maxNodes: 7 });
		expect(walk.map((item) => item.node.id)).toEqual([
			"view1",
			"g1",
			"g2",
			"g3",
			"a1",
			"b1",
			"c1",
		]);
	});

	it("nimmt alle View-Folder auf, auch wenn das Asset-Budget knapp ist", () => {
		const tree = view("view1", [
			group("g1", [asset("a1")]),
			group("g2", [asset("b1")]),
			group("g3", [asset("c1")]),
		]);
		const walk = collectPrioritizedGraphWalk(tree, { maxDepth: 10, maxNodes: 4 });
		expect(walk.map((item) => item.node.id)).toEqual(["view1", "g1", "g2", "g3"]);
	});

	it("lässt verschachtelte Gruppen in frühen Foldern die letzten Folders nicht leer", () => {
		const tree = view("view1", [
			group("g1", [group("g1-nested", [asset("deep")]), asset("a1"), asset("a2")]),
			group("g2", [asset("b1")]),
		]);
		const walk = collectPrioritizedGraphWalk(tree, { maxDepth: 10, maxNodes: 7 });
		const ids = walk.map((item) => item.node.id);
		expect(ids).toEqual(expect.arrayContaining(["view1", "g1", "g1-nested", "g2", "b1"]));
		expect(ids.indexOf("b1")).toBeGreaterThan(-1);
	});
});
