import {
	collectAssignedChildElements,
	collectAvailableChildElements,
	isLogicalViewGroupElement,
} from "./elementChildLinks";
import { assetMatchesFilterRule, assetMatchesXPath } from "./filterRulesMatch";

describe("isLogicalViewGroupElement", () => {
	it("View und VIEWGROUP/GROUP sind logisch", () => {
		expect(isLogicalViewGroupElement({ class: "View", definition: { storeType: "VIEWGROUP" } })).toBe(
			true
		);
		expect(isLogicalViewGroupElement({ class: "Group", definition: { storeType: "VIEWGROUP" } })).toBe(
			true
		);
		expect(isLogicalViewGroupElement({ class: "Group", definition: { storeType: "GROUP" } })).toBe(
			true
		);
	});

	it("physische Device/Component-Gruppen sind nicht logisch", () => {
		expect(
			isLogicalViewGroupElement({ class: "Asset", definition: { storeType: "COMPONENT" } })
		).toBe(false);
	});
});

describe("collectAssignedChildElements", () => {
	const root = {
		groups: {
			groups: [
				{
					id: "child-group",
					class: "Group",
					parentIdRef: "parent",
					definition: { name: "Child Group", baseType: "GROUP", description: "" },
				},
				{
					id: "free-group",
					class: "Group",
					parentIdRef: undefined,
					definition: { name: "Free", baseType: "GROUP", description: "" },
				},
			],
		},
		assets: {
			assets: [
				{
					id: "owned",
					class: "Asset",
					ownerIdRef: "parent",
					definition: { name: "Owned", type: "DEVICE", baseType: "COMPONENT", description: "" },
				},
				{
					id: "via-child-ref",
					class: "Asset",
					ownerIdRef: null,
					definition: { name: "Ref", type: "SERVICE", baseType: "COMPONENT", description: "" },
				},
				{
					id: "xpath-hit",
					class: "Asset",
					ownerIdRef: null,
					definition: { name: "Printer", type: "DEVICE", baseType: "COMPONENT", description: "" },
				},
				{
					id: "free-asset",
					class: "Asset",
					ownerIdRef: null,
					definition: { name: "Free", type: "SERVICE", baseType: "COMPONENT", description: "" },
				},
			],
		},
	} as any;

	const parent = {
		id: "parent",
		class: "Group",
		definition: { storeType: "VIEWGROUP" },
		elementIdRefs: [{ id: "via-child-ref" }],
		filterRules: [{ xpath: "//*[@type='DEVICE']" }],
	};

	it("sammelt Parent-Ref, Child-Ref und XPath", () => {
		const assigned = collectAssignedChildElements(root, parent).map((item) => item.id);
		expect(assigned).toEqual(expect.arrayContaining(["child-group", "owned", "via-child-ref", "xpath-hit"]));
		expect(assigned).not.toContain("free-asset");
		expect(assigned).not.toContain("free-group");
	});

	it("Available sind nur unverbundene Elemente", () => {
		const assigned = collectAssignedChildElements(root, parent);
		const available = collectAvailableChildElements(
			root,
			parent.id,
			new Set(assigned.map((item) => item.id))
		).map((item) => item.id);
		expect(available).toEqual(expect.arrayContaining(["free-group", "free-asset"]));
		expect(available).not.toContain("owned");
		expect(available).not.toContain("child-group");
	});
});

describe("filterRulesMatch", () => {
	it("matcht //DEVICE und Attribut-Prädikate", () => {
		const device = { definition: { type: "DEVICE", name: "is-printer" } };
		expect(assetMatchesXPath(device, "//DEVICE")).toBe(true);
		expect(assetMatchesXPath(device, "//*[@type='DEVICE']")).toBe(true);
		expect(assetMatchesFilterRule(device, { type: "DEVICE" })).toBe(true);
		expect(assetMatchesXPath(device, "//SERVICE")).toBe(false);
	});
});
