import { restLoadErrorRegistry } from "../Stores/RestLoadErrorRegistry";
import {
	collectReadInterfaceRows,
	collectReadObjectErrorRows,
	buildActivityStatusBadgeCount,
} from "./activityStatusOverview";
import { publishRestLoadReport, enrichRestLoadReport } from "./restSnapshot";
import { IRootStore } from "../Stores/Root.Store";

describe("activityStatusOverview read tiers", () => {
	beforeEach(() => {
		restLoadErrorRegistry.reportsBySource = {};
		restLoadErrorRegistry.errorsBySource = {};
	});

	it("shows successful interface row with loaded count", () => {
		const report = enrichRestLoadReport(
			{
				objectKind: "Asset",
				domain: "demo",
				responseFormat: "array",
				restCount: 5,
				loadedCount: 5,
				restIds: ["a1"],
				loadedIds: ["a1"],
				errors: [],
				loadedAt: new Date().toISOString(),
			},
			"Asset",
			"demo",
			{ env: "dev" }
		);
		publishRestLoadReport(report);

		const rows = collectReadInterfaceRows();
		expect(rows).toHaveLength(1);
		expect(rows[0].activity).toBe("read-interface");
		expect(rows[0].errorMessage).toContain("5 Element(e) geladen");
		expect(rows[0].httpStatus).toBe(200);
	});

	it("shows interface error and object errors separately", () => {
		const report = enrichRestLoadReport(
			{
				objectKind: "Asset",
				domain: "demo",
				responseFormat: "array",
				restCount: 2,
				loadedCount: 1,
				restIds: ["a1", "a2"],
				loadedIds: ["a1"],
				errors: [
					{
						objectKind: "Asset",
						itemId: "a2",
						message: "Parse failed",
					},
				],
				loadedAt: new Date().toISOString(),
			},
			"Asset",
			"demo",
			{ env: "dev" }
		);
		publishRestLoadReport(report);

		expect(collectReadInterfaceRows()[0].activity).toBe("read-interface-error");
		expect(collectReadObjectErrorRows()).toHaveLength(1);
		expect(collectReadObjectErrorRows()[0].itemId).toBe("a2");
	});

	it("shows internal and element schema interface rows separately", () => {
		for (const [objectKind, path, schemaBaseType] of [
			["InternalSchema", "/demo/config/schema/internals", "INTERNAL"],
			["ComponentSchema", "/demo/config/schema/components", "COMPONENT"],
		] as const) {
			publishRestLoadReport(
				enrichRestLoadReport(
					{
						objectKind,
						domain: "demo",
						responseFormat: "array",
						restCount: 1,
						loadedCount: 1,
						restIds: ["SCHEMA"],
						loadedIds: ["SCHEMA"],
						errors: [],
						loadedAt: new Date().toISOString(),
					},
					objectKind,
					"demo",
					{ schemaBaseType }
				)
			);
			expect(
				collectReadInterfaceRows().find((row) => row.kind === objectKind)?.rest.path
			).toBe(path);
		}

		const rows = collectReadInterfaceRows();
		expect(rows).toHaveLength(2);
		expect(rows.map((row) => row.kind).sort()).toEqual(["ComponentSchema", "InternalSchema"]);
	});

	it("counts read errors in badge total", () => {
		publishRestLoadReport(
			enrichRestLoadReport(
				{
					objectKind: "View",
					domain: "demo",
					responseFormat: "request-failed",
					restCount: 0,
					loadedCount: 0,
					restIds: [],
					loadedIds: [],
					errors: [{ objectKind: "View", itemId: "-", message: "HTTP 502" }],
					loadedAt: new Date().toISOString(),
					request: {
						method: "GET",
						path: "/demo/views",
						fullUrl: "http://localhost/demo/views",
						httpStatus: 502,
					},
				},
				"View",
				"demo"
			)
		);

		const badge = buildActivityStatusBadgeCount({
			views: { views: [] },
			groups: { groups: [] },
			assets: { assets: [] },
			connections: { connections: [] },
		} as unknown as IRootStore);
		expect(badge.readErrors).toBe(1);
		expect(badge.total).toBeGreaterThanOrEqual(1);
	});
});
