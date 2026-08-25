import {
	canSaveElementStatus,
	resolveChangeModeSaveRefs,
	shouldEnableChangeModeSave,
} from "./activityStatusActions";

describe("change-mode toolbar save", () => {
	it("canSaveElementStatus gilt für changed", () => {
		expect(canSaveElementStatus("changed")).toBe(true);
		expect(canSaveElementStatus("untouched")).toBe(false);
	});

	it("Speichern ist inaktiv, wenn nur ein Kind geändert ist", () => {
		expect(shouldEnableChangeModeSave("untouched")).toBe(false);
		expect(shouldEnableChangeModeSave("changed")).toBe(true);
		expect(shouldEnableChangeModeSave("new")).toBe(true);
	});

	it("resolveChangeModeSaveRefs speichert nur das aktive Element, nicht Children", () => {
		const changedAsset = {
			id: "a1",
			status: "changed",
			class: "Asset",
			definition: { name: "Asset" },
		};
		const root = {
			views: { views: [{ id: "v1", status: "untouched", class: "View", definition: { name: "View" } }] },
			groups: { groups: [] },
			assets: { assets: [changedAsset] },
			connections: { connections: [] },
		} as any;

		expect(resolveChangeModeSaveRefs(root, root.views.views[0]).map((ref) => ref.id)).toEqual([]);
		expect(resolveChangeModeSaveRefs(root, changedAsset as any).map((ref) => ref.id)).toEqual([
			"a1",
		]);
	});
});
