import {
	hierarchyAssignmentEpoch,
	hierarchyOwnerEpoch,
	hierarchyStatusEpoch,
} from "./hierarchyIndex";

describe("hierarchyIndex epochs", () => {
	it("assignmentEpoch ändert sich mit elementIdRefs, nicht mit status", () => {
		const groups = [
			{ parentIdRef: "view1", elementIdRefs: [{ id: "a1" }], status: "changed" },
		];
		const afterSave = [
			{ parentIdRef: "view1", elementIdRefs: [{ id: "a1" }], status: "untouched" },
		];
		expect(hierarchyAssignmentEpoch(groups)).toBe(hierarchyAssignmentEpoch(afterSave));
		expect(hierarchyStatusEpoch(groups, [])).not.toBe(hierarchyStatusEpoch(afterSave, []));
	});

	it("ownerEpoch folgt ownerIdRef", () => {
		expect(hierarchyOwnerEpoch([{ ownerIdRef: "g1" }])).toBe("g1");
		expect(hierarchyOwnerEpoch([{ ownerIdRef: null }])).toBe("");
	});
});
