import {
	resolveCreateTargetForSchema,
	resolveGroupDefinitionTypesForCreate,
} from "./elementDefinitionTypes";
import { ISchemaModel } from "../Stores/Models/Schema.Model";
import { collectLinkedAssetIdsForView, collectUnlinkedAssetsForView } from "./treeUnlinkedAssets";
import { resolveTreeNodeSegment } from "./treeNodeDisplay";

describe("treeUnlinkedAssets", () => {
	const root = {
		groups: {
			groups: [
				{
					id: "g1",
					parentIdRef: "view1",
					elementIdRefs: [{ id: "a-linked" }],
				},
				{
					id: "g2",
					parentIdRef: "g1",
					elementIdRefs: [{ id: "a-nested" }],
				},
			],
		},
		assets: {
			assets: [
				{ id: "a-linked" },
				{ id: "a-nested" },
				{ id: "a-free" },
			],
		},
	} as any;

	it("collectLinkedAssetIdsForView sammelt elementIdRefs rekursiv", () => {
		const linked = collectLinkedAssetIdsForView(root, "view1");
		expect(linked.has("a-linked")).toBe(true);
		expect(linked.has("a-nested")).toBe(true);
		expect(linked.has("a-free")).toBe(false);
	});

	it("collectUnlinkedAssetsForView liefert nur freie Assets", () => {
		const unlinked = collectUnlinkedAssetsForView(root, "view1");
		expect(unlinked.map((asset) => asset.id)).toEqual(["a-free"]);
	});

	it("Parent-Ref (ownerIdRef) und Stapel gelten als verknüpft", () => {
		const stackedRoot = {
			groups: {
				groups: [
					{
						id: "g1",
						parentIdRef: "view1",
						elementIdRefs: [],
					},
				],
			},
			assets: {
				assets: [
					{ id: "a-owned", ownerIdRef: "g1", definition: { type: "DEVICE" } },
					{ id: "a-stacked", ownerIdRef: "a-owned", definition: { type: "COMPONENT" } },
					{ id: "a-free", ownerIdRef: null, definition: { type: "DEVICE" } },
				],
			},
		} as any;

		const linked = collectLinkedAssetIdsForView(stackedRoot, "view1");
		expect(linked.has("a-owned")).toBe(true);
		expect(linked.has("a-stacked")).toBe(true);
		expect(linked.has("a-free")).toBe(false);
	});

	it("XPath/filterRules einer View-Gruppe zählen als Verknüpfung", () => {
		const xpathRoot = {
			groups: {
				groups: [
					{
						id: "g1",
						parentIdRef: "view1",
						elementIdRefs: [],
						filterRules: [{ xpath: "//DEVICE" }],
					},
				],
			},
			assets: {
				assets: [
					{ id: "a-device", definition: { type: "DEVICE" } },
					{ id: "a-other", definition: { type: "SERVICE" } },
				],
			},
		} as any;

		const unlinked = collectUnlinkedAssetsForView(xpathRoot, "view1");
		expect(unlinked.map((asset) => asset.id)).toEqual(["a-other"]);
	});
});

describe("resolveTreeNodeSegment", () => {
	it("VIEWGROUP und Legacy GROUP/INTERNAL sind viewGroup", () => {
		expect(resolveTreeNodeSegment({ storeType: "VIEWGROUP" }, "Group")).toBe("viewGroup");
		expect(resolveTreeNodeSegment({ storeType: "GROUP" }, "Group")).toBe("viewGroup");
		expect(resolveTreeNodeSegment({ storeType: "INTERNAL" }, "Group")).toBe("viewGroup");
	});

	it("COMPONENT und Asset sind component", () => {
		expect(resolveTreeNodeSegment({ storeType: "COMPONENT" }, "Asset")).toBe("component");
		expect(resolveTreeNodeSegment(undefined, "Asset")).toBe("component");
	});
});

describe("resolveCreateTargetForSchema", () => {
	const viewGroupSchema = {
		id: "AREA",
		storeType: "VIEWGROUP",
		baseType: "GROUP",
		type: "AREA",
		subType: "",
	} as ISchemaModel;

	const internalGroupSchema = {
		id: "ORG",
		storeType: "INTERNAL",
		baseType: "GROUP",
		type: "ORGANISATION",
		subType: "",
	} as ISchemaModel;

	const clusterSchema = {
		id: "CLUSTER",
		storeType: "COMPONENT",
		baseType: "COMPONENT",
		type: "GROUP",
		subType: "",
	} as ISchemaModel;

	it("VIEWGROUP/INTERNAL GROUP → group, COMPONENT → asset", () => {
		expect(resolveCreateTargetForSchema(viewGroupSchema)).toBe("group");
		expect(resolveCreateTargetForSchema(internalGroupSchema)).toBe("group");
		expect(resolveCreateTargetForSchema(clusterSchema)).toBe("asset");
	});

	it("resolveGroupDefinitionTypesForCreate setzt VIEWGROUP", () => {
		expect(resolveGroupDefinitionTypesForCreate(internalGroupSchema).storeType).toBe("VIEWGROUP");
	});
});
