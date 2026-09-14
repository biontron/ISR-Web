import {
	buildElementTreeNodes,
	collectTreeKeysForElementId,
	fillExpandedTreeNodes,
	treeNodeElementId,
} from "./elementTreeNodes";

function group(
	id: string,
	extras: Record<string, unknown> = {}
) {
	return {
		id,
		class: "Group",
		status: "untouched",
		parentIdRef: extras.parentIdRef,
		elementIdRefs: extras.elementIdRefs ?? [],
		filterRules: extras.filterRules ?? [],
		definition: {
			storeType: "VIEWGROUP",
			baseType: "GROUP",
			type: "AREA",
			subType: "",
			name: String(extras.name ?? id),
			description: "",
		},
	};
}

function asset(id: string, extras: Record<string, unknown> = {}) {
	return {
		id,
		class: "Asset",
		status: "untouched",
		ownerIdRef: extras.ownerIdRef ?? null,
		definition: {
			storeType: "COMPONENT",
			baseType: "COMPONENT",
			type: extras.type ?? "DEVICE",
			subType: "",
			name: String(extras.name ?? id),
			label: "",
			description: "",
		},
	};
}

function rootWith(groups: unknown[], assets: unknown[]) {
	return {
		groups: { groups },
		assets: { assets },
		configSchemas: { schemaCompat: [] },
	} as never;
}

describe("elementTreeNodes", () => {
	it("gibt derselben Asset-ID unter zwei Parents eigene Keys", () => {
		const shared = asset("device-1");
		const root = rootWith(
			[
				group("g-a", { parentIdRef: "view1", elementIdRefs: [{ id: "device-1" }] }),
				group("g-b", { parentIdRef: "view1", elementIdRefs: [{ id: "device-1" }] }),
			],
			[shared]
		);
		const tree = buildElementTreeNodes(root, {
			id: "view1",
			class: "View",
			filterRules: [],
		});

		expect(collectTreeKeysForElementId(tree, "device-1")).toEqual([]);
		expect(tree.map((node) => node.key)).toEqual(["g-a", "g-b"]);
		expect(tree.every((node) => node.isLeaf === false)).toBe(true);

		const underA = buildElementTreeNodes(root, {
			id: "g-a",
			class: "Group",
			elementIdRefs: [{ id: "device-1" }],
			filterRules: [],
		}, { parentKey: "g-a", ancestorIds: new Set(["view1", "g-a"]) });
		expect(underA.map((node) => node.key)).toEqual(["g-a/device-1"]);
	});

	it("erlaubt denselben XPath-Treffer unter View und Group", () => {
		const device = asset("device-1");
		const root = rootWith(
			[
				group("g-devices", {
					parentIdRef: "view1",
					filterRules: [{ xpath: "definition/type='DEVICE'", description: "" }],
				}),
			],
			[device]
		);
		const tree = buildElementTreeNodes(root, {
			id: "view1",
			class: "View",
			filterRules: [{ xpath: "definition/type='DEVICE'", description: "" }],
		});

		expect(collectTreeKeysForElementId(tree, "device-1")).toEqual(["device-1"]);
		expect(tree.find((node) => treeNodeElementId(node) === "g-devices")?.isLeaf).toBe(false);

		const underGroup = buildElementTreeNodes(root, {
			id: "g-devices",
			class: "Group",
			filterRules: [{ xpath: "definition/type='DEVICE'", description: "" }],
		}, { parentKey: "g-devices", ancestorIds: new Set(["view1", "g-devices"]) });
		expect(underGroup.map((node) => node.key)).toEqual(["g-devices/device-1"]);
	});

	it("bricht Filter-Zyklen ab und bleibt endlich", () => {
		const root = rootWith(
			[
				group("g-a", {
					parentIdRef: undefined,
					filterRules: [{ xpath: "id='g-b'", description: "" }],
				}),
				group("g-b", {
					parentIdRef: undefined,
					filterRules: [{ xpath: "id='g-a'", description: "" }],
				}),
			],
			[]
		);
		const tree = buildElementTreeNodes(root, {
			id: "view1",
			class: "View",
			filterRules: [{ xpath: "class='Group'", description: "" }],
		});

		expect(tree.map((node) => node.key).sort()).toEqual(["g-a", "g-b"]);
		const underA = buildElementTreeNodes(root, {
			id: "g-a",
			class: "Group",
			filterRules: [{ xpath: "id='g-b'", description: "" }],
		}, { parentKey: "g-a", ancestorIds: new Set(["view1", "g-a"]) });
		expect(underA.map((node) => node.key)).toEqual(["g-a/g-b"]);
		const underBA = buildElementTreeNodes(root, {
			id: "g-b",
			class: "Group",
			filterRules: [{ xpath: "id='g-a'", description: "" }],
		}, { parentKey: "g-a/g-b", ancestorIds: new Set(["view1", "g-a", "g-b"]) });
		expect(underBA[0]?.isLeaf).toBe(true);
	});

	it("hängt Funktions-Components unter dem Device auf", () => {
		const device = asset("device-1");
		const os = asset("os-1", { ownerIdRef: "device-1", type: "OS", name: "OS" });
		const root = rootWith(
			[group("g-a", { parentIdRef: "view1", elementIdRefs: [{ id: "device-1" }] })],
			[device, os]
		);
		const underDevice = buildElementTreeNodes(root, {
			id: "device-1",
			class: "Asset",
		}, { parentKey: "g-a/device-1", ancestorIds: new Set(["view1", "g-a", "device-1"]) });
		expect(underDevice.map((node) => treeNodeElementId(node))).toEqual(["os-1"]);
	});

	it("fillExpandedTreeNodes lädt Device-Kinder nach einem Rebuild nach", () => {
		const device = asset("device-1");
		const os = asset("os-1", { ownerIdRef: "device-1", type: "OS", name: "OS" });
		const root = rootWith(
			[group("g-a", { parentIdRef: "view1", elementIdRefs: [{ id: "device-1" }] })],
			[device, os]
		);
		const firstLevel = buildElementTreeNodes(root, {
			id: "view1",
			class: "View",
			filterRules: [],
		});
		const filled = fillExpandedTreeNodes(root, firstLevel, ["g-a", "g-a/device-1"], "view1");
		const groupNode = filled.find((node) => treeNodeElementId(node) === "g-a");
		const deviceNode = groupNode?.children?.find((node) => treeNodeElementId(node) === "device-1");
		expect(deviceNode?.children?.map((node) => treeNodeElementId(node))).toEqual(["os-1"]);
	});
});
