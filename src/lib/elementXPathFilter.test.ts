import {
	collectFilterAvailableElements,
	collectFilterMatchedElements,
	collectFilterMatchedElementsExcluding,
	elementMatchesXPath,
	elementToFilterXml,
} from "./elementXPathFilter";

function device(id: string, extras: Record<string, unknown> = {}) {
	return {
		id,
		class: "Asset",
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
		ownerIdRef: null,
	};
}

describe("elementXPathFilter", () => {
	it("serialisiert definition und tags als XML", () => {
		const xml = elementToFilterXml(device("A-1") as never);
		expect(xml).toContain("<id>A-1</id>");
		expect(xml).toContain("<type>DEVICE</type>");
		expect(xml).toContain("<tag>Client</tag>");
	});

	it("wertet relative XPath-Prädikate gegen <element> aus", () => {
		const asset = device("A-1");
		expect(elementMatchesXPath(asset as never, "definition/type='DEVICE'")).toBe(true);
		expect(elementMatchesXPath(asset as never, "definition/subType='PRINTER'")).toBe(false);
		expect(elementMatchesXPath(asset as never, "definition/tags/tag='Client'")).toBe(true);
		expect(elementMatchesXPath(asset as never, "starts-with(definition/name,'is-')")).toBe(true);
	});

	it("akzeptiert //element[…] gegen das Dokument", () => {
		expect(
			elementMatchesXPath(device("A-1") as never, "//element[definition/type='DEVICE']")
		).toBe(true);
	});

	it("wertet match() und matches() als Regulärausdruck aus", () => {
		const asset = device("A-1");
		expect(elementMatchesXPath(asset as never, "match(definition/name, 'is-.*')")).toBe(true);
		expect(elementMatchesXPath(asset as never, "matches(definition/name, '^is-')")).toBe(true);
		expect(elementMatchesXPath(asset as never, "fn:matches(definition/name, '^IS-', 'i')")).toBe(
			true
		);
		expect(elementMatchesXPath(asset as never, "match(definition/name, '^hp-')")).toBe(false);
		expect(
			elementMatchesXPath(
				asset as never,
				"definition/type='DEVICE' and match(definition/name, '^is-')"
			)
		).toBe(true);
		expect(elementMatchesXPath(asset as never, "not(match(definition/subType, 'PRINTER'))")).toBe(
			true
		);
		expect(elementMatchesXPath(asset as never, "match(definition/tags/tag, 'Client')")).toBe(true);
	});

	it("teilt unzugeordnete Elemente in Treffer und Verfügbare", () => {
		const root = {
			groups: {
				groups: [
					{
						id: "g-free",
						class: "Group",
						parentIdRef: undefined,
						definition: { type: "AREA", name: "Free", subType: "", description: "" },
					},
				],
			},
			assets: {
				assets: [
					device("a-device"),
					{
						...device("a-printer", { type: "DEVICE", subType: "PRINTER", name: "hp-1", tags: [] }),
					},
					{ ...device("a-linked"), ownerIdRef: "view1" },
				],
			},
		} as never;

		const rules = [{ xpath: "definition/subType='DESKTOP'", description: "Desktops" }];
		expect(collectFilterMatchedElements(root, "view1", rules).map((item) => item.id)).toEqual([
			"a-device",
		]);
		expect(collectFilterAvailableElements(root, "view1", rules).map((item) => item.id)).toEqual([
			"g-free",
			"a-printer",
		]);
		expect(
			collectFilterMatchedElementsExcluding(root, "view1", rules, ["a-device"]).map(
				(item) => item.id
			)
		).toEqual([]);
		expect(root.assets.assets.find((asset: { id: string }) => asset.id === "a-device")?.ownerIdRef).toBe(
			null
		);
	});
});
