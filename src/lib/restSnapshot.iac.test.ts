import { types } from "mobx-state-tree";
import { normalizeRestArray, loadRestArrayIntoStore } from "./restSnapshot";
import { IaCPackageModel } from "../Stores/Models/IaCPackage.Model";

function iacListItemId(item: unknown): string {
	if (item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string") {
		return (item as { name: string }).name;
	}
	return "unknown";
}

describe("normalizeRestArray IaC list items", () => {
	const item = {
		name: "test1",
		uri: "/isr/demo/iac/packages/test/templates/test1",
	};

	it("akzeptiert ein einzelnes { name, uri }-Objekt", () => {
		expect(normalizeRestArray(item)).toEqual({
			items: [item],
			format: "single-iac-list-item",
		});
	});

	it("akzeptiert wrapper.templates", () => {
		expect(normalizeRestArray({ templates: [item] })).toEqual({
			items: [item],
			format: "wrapper.templates",
		});
	});

	it("akzeptiert wrapper.packages", () => {
		const pkg = { name: "test", uri: "/isr/demo/iac/packages/test" };
		expect(normalizeRestArray({ packages: [pkg] })).toEqual({
			items: [pkg],
			format: "wrapper.packages",
		});
	});
});

describe("loadRestArrayIntoStore IaC packages", () => {
	it("meldet keine Fehl-Positives wenn Identifier name ist", () => {
		const Container = types.model({ packages: types.array(IaCPackageModel) });
		const store = Container.create({ packages: [] });
		const pkg = { name: "test", uri: "/isr/demo/iac/packages/test" };
		const report = loadRestArrayIntoStore(store.packages, IaCPackageModel, [pkg], "IaCPackage", {
			getItemId: iacListItemId,
		});

		expect(report.errors).toHaveLength(0);
		expect(report.loadedCount).toBe(1);
		expect(store.packages[0]?.name).toBe("test");
	});
});
