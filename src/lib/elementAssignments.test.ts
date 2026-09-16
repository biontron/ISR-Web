import {
	addXPathFilterRule,
	collectAssignedElements,
	collectUnassignedElements,
	isAssignedToParent,
	isStaticallyUnassigned,
	readXPathExpression,
	removeXPathFilterRule,
	toAssetElementIdRef,
	unassignElementFromParent,
	updateXPathFilterRule,
	wouldCreateAssignmentCycle,
} from "./elementAssignments";

function group(id: string, parentIdRef?: string) {
	return { id, class: "Group" as const, parentIdRef };
}

function asset(id: string, ownerIdRef?: string | null) {
	return { id, class: "Asset" as const, ownerIdRef };
}

function elementIdRef(id: string, environmentId = "", extras: Record<string, string> = {}) {
	return {
		environmentId,
		id,
		baseType: extras.baseType ?? "",
		type: extras.type ?? "",
		subType: extras.subType ?? "",
		name: extras.name ?? "",
		label: extras.label ?? "",
	};
}

describe("elementAssignments", () => {
	const root = {
		groups: {
			groups: [
				group("g-linked", "view1"),
				group("g-free"),
				group("g-other", "view2"),
			],
		},
		assets: {
			assets: [
				asset("a-linked", "view1"),
				asset("a-free"),
				asset("a-child", "a-parent"),
				asset("a-parent", "view1"),
			],
		},
	} as any;

	it("ordnet Gruppen über parentIdRef und Assets über ownerIdRef zu", () => {
		expect(isAssignedToParent(group("g1", "view1") as any, "view1")).toBe(true);
		expect(isAssignedToParent(asset("a1", "view1") as any, "view1")).toBe(true);
		expect(isStaticallyUnassigned(group("g2") as any)).toBe(true);
		expect(isStaticallyUnassigned(asset("a2", null) as any)).toBe(true);
	});

	it("collectAssignedElements listet verknüpfte View-Gruppen und Assets", () => {
		const assigned = collectAssignedElements(root, "view1").map((item) => item.id);
		expect(assigned).toEqual(["g-linked", "a-linked", "a-parent"]);
	});

	it("collectUnassignedElements listet nur freie View-Gruppen und Assets", () => {
		const unassigned = collectUnassignedElements(root, "view1").map((item) => item.id);
		expect(unassigned).toEqual(["g-free", "a-free"]);
	});

	it("wouldCreateAssignmentCycle erkennt Asset-Zyklen", () => {
		expect(wouldCreateAssignmentCycle(asset("a-parent") as any, "a-child", root)).toBe(true);
		expect(wouldCreateAssignmentCycle(asset("a-free") as any, "view1", root)).toBe(false);
	});

	it("unassignElementFromParent löst Parent-Ref und entfernt Child-Ref", () => {
		const child: {
			id: string;
			class: "Asset";
			ownerIdRef: string | null;
			environmentId: string;
			setOwnerIdRef: (ownerId: string | null) => void;
		} = {
			id: "a1",
			class: "Asset",
			ownerIdRef: "g1",
			environmentId: "office",
			setOwnerIdRef(ownerId: string | null) {
				this.ownerIdRef = ownerId;
			},
		};
		const parent = {
			id: "g1",
			class: "Group",
			elementIdRefs: [
				elementIdRef("a1", "office"),
				elementIdRef("a2", "office"),
			],
			setElementIdRefs(refs: ReturnType<typeof elementIdRef>[]) {
				this.elementIdRefs = refs;
			},
		};

		unassignElementFromParent(child as any, parent);

		expect(child.ownerIdRef).toBeNull();
		expect(parent.elementIdRefs).toEqual([elementIdRef("a2", "office")]);
	});

	it("stempelt Environment-Refs an neue XPath-Regeln", () => {
		const added = addXPathFilterRule([], "definition/type='DEVICE'", "Geräte", [
			{ ref: "office" },
		]);
		expect(added[0]).toEqual({
			xpath: "definition/type='DEVICE'",
			description: "Geräte",
			environments: [{ ref: "office" }],
			activated: true,
		});
	});

	it("XPath-Regeln anlegen und löschen", () => {
		const added = addXPathFilterRule([], "//asset[type='DEVICE']", "Geräte");
		expect(added[0]).toEqual({
			xpath: "//asset[type='DEVICE']",
			description: "Geräte",
			environments: [],
			activated: true,
		});
		expect(readXPathExpression(added[0])).toBe("//asset[type='DEVICE']");
		expect(addXPathFilterRule(added, "//asset[type='DEVICE']")).toEqual(added);
		expect(removeXPathFilterRule(added, 0)).toEqual([]);
	});

	it("aktualisiert die Beschreibung einer Regel", () => {
		const added = addXPathFilterRule([], "definition/type='DEVICE'");
		const updated = updateXPathFilterRule(added, 0, { description: "Virtuelle Maschinen" });
		expect(updated[0]).toEqual({
			xpath: "definition/type='DEVICE'",
			description: "Virtuelle Maschinen",
			environments: [],
			activated: true,
		});
	});

	it("liest xpath und legacy filterRule", () => {
		expect(readXPathExpression({ xpath: "definition/type='DEVICE'" })).toBe(
			"definition/type='DEVICE'"
		);
		expect(readXPathExpression({ filterRule: "definition/subType='DESKTOP'" })).toBe(
			"definition/subType='DESKTOP'"
		);
	});

	it("collectAssignedElements berücksichtigt elementIdRefs mit environmentId", () => {
		const envRoot = {
			groups: {
				groups: [
					{
						id: "g1",
						class: "Group",
						parentIdRef: "view1",
						elementIdRefs: [elementIdRef("a-ref", "office")],
					},
				],
			},
			assets: {
				assets: [
					{ id: "a-ref", class: "Asset", ownerIdRef: null, environmentId: "office" },
					{ id: "a-other", class: "Asset", ownerIdRef: null, environmentId: "home" },
				],
			},
		} as any;
		expect(collectAssignedElements(envRoot, "g1").map((item) => item.id)).toEqual(["a-ref"]);
	});

	it("stempelt ElementIdRefType-Felder aus dem Asset", () => {
		expect(
			toAssetElementIdRef({
				id: "a-1",
				environmentId: "office",
				definition: {
					baseType: "COMPONENT",
					type: "DEVICE",
					subType: "DESKTOP",
					name: "Notebook",
					label: "NB-01",
				},
			})
		).toEqual({
			environmentId: "office",
			id: "a-1",
			baseType: "COMPONENT",
			type: "DEVICE",
			subType: "DESKTOP",
			name: "Notebook",
			label: "NB-01",
		});
	});
});
