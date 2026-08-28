import {
	addXPathFilterRule,
	collectAssignedElements,
	collectUnassignedElements,
	isAssignedToParent,
	isStaticallyUnassigned,
	readXPathExpression,
	removeXPathFilterRule,
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
			setOwnerIdRef: (ownerId: string | null) => void;
		} = {
			id: "a1",
			class: "Asset",
			ownerIdRef: "g1",
			setOwnerIdRef(ownerId: string | null) {
				this.ownerIdRef = ownerId;
			},
		};
		const parent = {
			id: "g1",
			elementIdRefs: [{ id: "a1" }, { id: "a2" }],
			setElementIdRefs(refs: Array<{ id: string }>) {
				this.elementIdRefs = refs;
			},
		};

		unassignElementFromParent(child as any, parent);

		expect(child.ownerIdRef).toBeNull();
		expect(parent.elementIdRefs).toEqual([{ id: "a2" }]);
	});

	it("XPath-Regeln anlegen und löschen", () => {
		const added = addXPathFilterRule([], "//asset[type='DEVICE']", "Geräte");
		expect(added[0]).toEqual({ xpath: "//asset[type='DEVICE']", description: "Geräte" });
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
});
