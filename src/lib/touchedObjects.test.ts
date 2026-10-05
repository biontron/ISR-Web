import "../Stores/Root.Store";
import authStore from "../Stores/Auth.Store";
import { EnvironmentModel } from "../Stores/Models/Environment.Model";
import { collectTouchedObjects, hasTouchedObjects, undoTouchedObject } from "./touchedObjects";
import { buildRestRequestForTouchedObject } from "./restRequestForTouchedObject";

describe("touchedObjects", () => {
	it("erkennt pending Views, Groups und Assets", () => {
		const root = {
			views: { views: [{ id: "v1", status: "edit", definition: { name: "View A" } }] },
			groups: { groups: [{ id: "g1", status: "changed", definition: { name: "Group B" } }] },
			assets: { assets: [{ id: "a1", status: "new", definition: { name: "Asset C" } }] },
			connections: { connections: [] },
		} as any;

		const pending = collectTouchedObjects(root);
		expect(pending).toHaveLength(3);
		expect(pending.map((p) => p.id)).toEqual(["v1", "g1", "a1"]);
		expect(hasTouchedObjects(root)).toBe(true);
	});

	it("ignoriert untouched Elemente", () => {
		const root = {
			views: { views: [{ id: "v1", status: "untouched", definition: { name: "View" } }] },
			groups: { groups: [] },
			assets: { assets: [] },
			connections: { connections: [] },
		} as any;

		expect(collectTouchedObjects(root)).toEqual([]);
		expect(hasTouchedObjects(root)).toBe(false);
	});

	it("erkennt gelöschte und neue Connections", () => {
		const root = {
			views: { views: [] },
			groups: { groups: [] },
			assets: { assets: [] },
			connections: {
				connections: [
					{ id: "c1", status: "deleted", definition: { name: "Conn D" } },
					{ id: "c2", status: "new", definition: { name: "Conn N" } },
				],
			},
		} as any;

		const pending = collectTouchedObjects(root);
		expect(pending).toHaveLength(2);
		expect(pending.map((p) => p.touch)).toEqual(["delete", "create"]);
	});

	it("nimmt eine geänderte Ignorierliste als Environment-Update auf", () => {
		const emptyRoot = {
			views: { views: [] },
			groups: { groups: [] },
			assets: { assets: [] },
			connections: { connections: [] },
		} as any;
		expect(collectTouchedObjects(emptyRoot)).toEqual([]);

		const environment = EnvironmentModel.create({
			id: "env-1",
			definition: { name: "München" },
			properties: { bgColor: "#fff", ignoredDevices: ["Printer"] },
		});
		environment.setIgnoredDevices(["Printer", "Scanner"]);
		const root = {
			...emptyRoot,
			environments: { environments: [environment] },
			ui: { activeView: undefined },
		} as any;

		const pending = collectTouchedObjects(root);
		expect(pending).toHaveLength(1);
		expect(pending[0]).toMatchObject({
			id: "env-1",
			kind: "Environment",
			touch: "update",
			name: "München",
			status: "changed",
		});

		const domain = jest.spyOn(authStore, "getDomain").mockReturnValue("demo");
		try {
			const request = buildRestRequestForTouchedObject(root, pending[0]);
			expect(request.method).toBe("PUT");
			expect(request.path).toBe("/demo/environments/env-1");
			expect(request.payload).toMatchObject({
				id: "env-1",
				properties: { ignoredDevices: ["Printer", "Scanner"] },
			});
		} finally {
			domain.mockRestore();
		}

		undoTouchedObject(root, pending[0]);
		expect(environment.properties.ignoredDevices.slice()).toEqual(["Printer"]);
		expect(environment.status).toBe("untouched");
		expect(collectTouchedObjects(root)).toEqual([]);
	});
});
