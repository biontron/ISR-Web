import {
	addValidationRule,
	collectViewElementMarks,
	collectViewSearchHits,
	elementMatchesFreetext,
	fieldPathHasMark,
	freetextToValidationXPath,
	resolveSearchMode,
	searchQueryToValidationXPath,
} from "./elementXPathValidation";
import { collectXPathMatchFieldPaths, elementToFilterXml } from "./elementXPathFilter";

function device(id: string, extras: Record<string, unknown> = {}) {
	return {
		id,
		class: "Asset",
		status: "untouched",
		definition: {
			storeType: "COMPONENT",
			baseType: "COMPONENT",
			type: "DEVICE",
			subType: "DESKTOP",
			name: "is-ws1",
			label: "Workstation",
			description: "",
			tags: [{ tag: "Client" }],
			...extras,
		},
		ownerIdRef: "view-1",
	};
}

function connection(id: string) {
	return {
		id,
		class: "Connection",
		status: "changed",
		definition: { label: "Uplink", description: "core link" },
		links: [
			{
				id: "L1",
				title: "fiber",
				fromComponentRef: "A-1",
				toComponentRef: "A-2",
				fromDockRef: "",
				toDockRef: "",
			},
		],
		settings: {},
	};
}

describe("elementXPathValidation", () => {
	it("unterscheidet Freitext und XPath", () => {
		expect(resolveSearchMode("Workstation")).toBe("freetext");
		expect(resolveSearchMode("definition/type='DEVICE'")).toBe("xpath");
		expect(resolveSearchMode("[[[")).toBe("freetext");
	});

	it("findet Freitext in Definition und Connection", () => {
		expect(elementMatchesFreetext(device("A-1") as never, "workstation")).toBe(true);
		expect(elementMatchesFreetext(device("A-1") as never, "printer")).toBe(false);
		expect(elementMatchesFreetext(connection("C-1") as never, "uplink")).toBe(true);
		expect(elementMatchesFreetext(connection("C-1") as never, "fiber")).toBe(true);
	});

	it("sammelt positive und negative Marken unabhängig vom Änderungsstatus", () => {
		const asset = { ...device("A-1"), status: "edit" };
		const view = {
			id: "view-1",
			validationRules: [
				{ xpath: "definition/type='DEVICE'", description: "Geräte", polarity: "positive" },
				{ xpath: "definition/subType='DESKTOP'", description: "Desktop", polarity: "negative" },
			],
			children: () => [asset],
		};
		const root = {
			assets: { assets: [asset] },
			connections: { connections: [connection("C-1")] },
		};
		const marks = collectViewElementMarks(root as never, view as never, "");
		expect(marks.get("A-1")).toMatchObject({
			changed: true,
			positive: true,
			negative: true,
			searchMatch: false,
		});
		expect(marks.get("A-1")?.fieldPaths).toEqual(expect.arrayContaining(["definition.type"]));
	});

	it("findet die View selbst mit matches(definition/baseType,\"VIEW\")", () => {
		const view = {
			id: "view-1",
			class: "View",
			status: "untouched",
			definition: {
				storeType: "VIEWGROUP",
				baseType: "VIEW",
				type: "VIEW",
				name: "Campus",
				description: "",
			},
			validationRules: [],
			children: () => [],
		};
		const other = {
			id: "view-2",
			class: "View",
			definition: { baseType: "VIEW", name: "Werk" },
		};
		const root = {
			assets: { assets: [] },
			connections: { connections: [] },
			views: { views: [view, other] },
		};
		const marks = collectViewElementMarks(
			root as never,
			view as never,
			'matches(definition/baseType,"VIEW")'
		);
		expect(marks.get("view-1")?.searchMatch).toBe(true);
		expect(marks.get("view-2")?.searchMatch).toBe(true);
		const hits = collectViewSearchHits(
			root as never,
			view as never,
			'matches(definition/baseType,"VIEW")',
			marks
		);
		expect(hits.map((hit) => hit.id).sort()).toEqual(["view-1", "view-2"]);
	});

	it("bezieht Connections in die Suche ein", () => {
		const asset = device("A-1");
		const link = connection("C-1");
		const view = {
			id: "view-1",
			validationRules: [],
			children: () => [asset],
		};
		const root = {
			assets: { assets: [asset] },
			connections: { connections: [link] },
		};
		const marks = collectViewElementMarks(root as never, view as never, "Uplink");
		expect(marks.get("C-1")?.searchMatch).toBe(true);
		const hits = collectViewSearchHits(root as never, view as never, "Uplink", marks);
		expect(hits.map((hit) => hit.id)).toContain("C-1");
		expect(hits.find((hit) => hit.id === "C-1")?.title).toBe("Uplink");
	});

	it("mappt XPath-Pfade auf MST-Felder", () => {
		const xml = elementToFilterXml(device("A-1") as never);
		expect(xml).toContain("<class>Asset</class>");
		expect(collectXPathMatchFieldPaths(device("A-1") as never, "definition/type='DEVICE'")).toContain(
			"definition.type"
		);
	});

	it("prüft Feldpfad-Überlappung", () => {
		expect(fieldPathHasMark("docks[0].settings.ip", ["docks[0].settings"])).toBe(true);
		expect(fieldPathHasMark("definition.name", ["definition.type"])).toBe(false);
	});

	it("erzeugt Validierungsregeln aus Freitext", () => {
		expect(searchQueryToValidationXPath("is-ws")).toContain("contains(definition/name");
		expect(searchQueryToValidationXPath("definition/type='DEVICE'")).toBe(
			"definition/type='DEVICE'"
		);
		expect(freetextToValidationXPath("a'b")).toContain("\"a'b\"");
		expect(
			addValidationRule([], "definition/type='DEVICE'", "Geräte", "positive")
		).toEqual([
			{ xpath: "definition/type='DEVICE'", description: "Geräte", polarity: "positive" },
		]);
	});
});
