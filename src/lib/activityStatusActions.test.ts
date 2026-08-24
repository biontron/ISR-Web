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

	it("Speichern bleibt aktiv, wenn nur ein Kind geändert ist", () => {
		expect(shouldEnableChangeModeSave("untouched", true)).toBe(true);
		expect(shouldEnableChangeModeSave("untouched", false)).toBe(false);
		expect(shouldEnableChangeModeSave("changed", false)).toBe(true);
	});

	it("resolveChangeModeSaveRefs nimmt das aktive Element, sonst alle Touched", () => {
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

		expect(resolveChangeModeSaveRefs(root, root.views.views[0]).map((ref) => ref.id)).toEqual([
			"a1",
		]);
		expect(resolveChangeModeSaveRefs(root, changedAsset as any).map((ref) => ref.id)).toEqual([
			"a1",
		]);
	});
});
