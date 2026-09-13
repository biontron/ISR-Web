import {
	defaultBindingsForNewView,
	LEGACY_ENVIRONMENT_ID,
	readViewEnvironmentBindings,
	resolveCreateEnvironmentTarget,
	resolvePrimaryEnvironmentRef,
	resolveViewEnvironmentRefs,
	slugViewCollectionId,
	viewRequiresEnvironmentPicker,
} from "./viewEnvironments";

describe("viewEnvironments", () => {
	it("liest refs und Primary", () => {
		const view = {
			environments: [
				{ ref: "home" },
				{ ref: "office", primary: true },
				{ ref: "home" },
			],
		};
		expect(readViewEnvironmentBindings(view)).toEqual([
			{ ref: "home", primary: false },
			{ ref: "office", primary: true },
		]);
		expect(resolveViewEnvironmentRefs(view)).toEqual(["home", "office"]);
		expect(resolvePrimaryEnvironmentRef(view)).toBe("office");
	});

	it("fällt ohne Bindung auf Legacy-München zurück", () => {
		expect(resolveViewEnvironmentRefs({})).toEqual([LEGACY_ENVIRONMENT_ID]);
		expect(resolvePrimaryEnvironmentRef({})).toBe(LEGACY_ENVIRONMENT_ID);
	});

	it("nimmt ohne Primary-Flag das erste Environment", () => {
		expect(resolvePrimaryEnvironmentRef({ environments: [{ ref: "a" }, { ref: "b" }] })).toBe("a");
	});

	it("verlangt einen Picker nur bei mehreren Bindungen", () => {
		expect(viewRequiresEnvironmentPicker({ environments: [{ ref: "a" }] })).toBe(false);
		expect(viewRequiresEnvironmentPicker({ environments: [{ ref: "a" }, { ref: "b" }] })).toBe(true);
	});

	it("nimmt die Auswahl als Anlageziel, sonst Primary", () => {
		const view = { environments: [{ ref: "home" }, { ref: "office", primary: true }] };
		expect(resolveCreateEnvironmentTarget(view, "home")).toBe("home");
		expect(resolveCreateEnvironmentTarget(view, "missing")).toBe("office");
		expect(resolveCreateEnvironmentTarget(view)).toBe("office");
	});

	it("bildet die View-Collection-ID aus dem Namen", () => {
		expect(slugViewCollectionId("PROD")).toBe("prod");
		expect(slugViewCollectionId("Smart Office")).toBe("smartoffice");
		expect(slugViewCollectionId("  Dev_1 ")).toBe("dev_1");
	});

	it("kopiert aktive Bindungen für eine neue View", () => {
		expect(
			defaultBindingsForNewView({ environments: [{ ref: "home", primary: true }] }, ["office"])
		).toEqual([{ ref: "home", primary: true }]);
		expect(defaultBindingsForNewView({}, ["office"])).toEqual([{ ref: "office", primary: true }]);
		expect(defaultBindingsForNewView({}, [])).toEqual([]);
	});
});
