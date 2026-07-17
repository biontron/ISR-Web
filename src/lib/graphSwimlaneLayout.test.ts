import {
	assignComponentsToSwimlanes,
	collectSwimlaneComponents,
	collectSwimlaneComponentsFromTree,
	isSwimlaneComponent,
	resolveSwimlaneIdForComponent,
} from "./graphSwimlaneLayout";
import { DEFAULT_GRAPH_CONFIG } from "./graphConfig";
import { TreeElement } from "../Interfaces/Element";

function createAsset(id: string, tags: { tag: string }[] = []): TreeElement {
	return {
		id,
		class: "Asset",
		definition: {
			baseType: "COMPONENT",
			type: "DEVICE",
			subType: "",
			name: id,
			label: id,
			description: "",
			tags,
		},
		children: () => [],
	} as unknown as TreeElement;
}

function createGroup(id: string, children: TreeElement[] = []): TreeElement {
	return {
		id,
		class: "Group",
		definition: {
			baseType: "GROUP",
			type: "AREA",
			subType: "",
			name: id,
			description: "",
			tags: [],
		},
		children: () => children,
	} as unknown as TreeElement;
}

describe("graphSwimlaneLayout", () => {
	it("erkennt Components für Swimlane-Zuordnung", () => {
		expect(isSwimlaneComponent(createAsset("a1"))).toBe(true);
		expect(isSwimlaneComponent(createGroup("g1"))).toBe(false);
	});

	it("sammelt Components im Baum unabhängig von der Verschachtelung", () => {
		const root = createGroup("root", [
			createGroup("nested", [createAsset("a1", [{ tag: "#database" }])]),
			createAsset("a2", [{ tag: "#service" }]),
		]);

		const fromTree = collectSwimlaneComponentsFromTree(root);
		expect(fromTree.map((node) => node.id).sort()).toEqual(["a1", "a2"]);

		const g = {
			hasNode: (id: string) => ["root", "nested", "a1", "a2"].includes(id),
		};

		const components = collectSwimlaneComponents(root, g);
		expect(components.map((node) => node.id).sort()).toEqual(["a1", "a2"]);
	});

	it("ordnet Components per Hashtag zu — Rest in ungrouped", () => {
		const components = [
			createAsset("db", [{ tag: "#database" }]),
			createAsset("svc", [{ tag: "service" }]),
			createAsset("other", []),
		];
		const byLane = assignComponentsToSwimlanes(components, DEFAULT_GRAPH_CONFIG);

		expect(byLane.get("Databases")?.map((node) => node.id)).toEqual(["db"]);
		expect(byLane.get("Services")?.map((node) => node.id)).toEqual(["svc"]);
		expect(byLane.get("ungrouped")?.map((node) => node.id)).toEqual(["other"]);
		expect(resolveSwimlaneIdForComponent(createAsset("x", [{ tag: "#Network" }]), DEFAULT_GRAPH_CONFIG)).toBe(
			"Network"
		);
	});

	it("ordnet legacy map tags (definition.tags.tag) zu", () => {
		const legacy = {
			id: "legacy",
			class: "Asset",
			definition: {
				baseType: "COMPONENT",
				type: "DEVICE",
				subType: "",
				name: "legacy",
				label: "legacy",
				description: "",
				tags: { tag: "#client" },
			},
			children: () => [],
		} as unknown as TreeElement;
		expect(resolveSwimlaneIdForComponent(legacy, DEFAULT_GRAPH_CONFIG)).toBe("Clients");
	});

	it("enthält alle konfigurierten Lanes in der Zuordnungs-Map", () => {
		const byLane = assignComponentsToSwimlanes([], DEFAULT_GRAPH_CONFIG);
		expect(Array.from(byLane.keys())).toEqual(DEFAULT_GRAPH_CONFIG.swimlanes.map((lane) => lane.id));
	});
});
