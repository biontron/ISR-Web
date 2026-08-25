import {
	resolveCreateTargetForSchema,
	resolveGroupDefinitionTypesForCreate,
} from "./elementDefinitionTypes";
import { ISchemaModel } from "../Stores/Models/Schema.Model";
import { collectLinkedAssetIdsForView, collectUnlinkedAssetsForView, collectUnlinkedElementsForView } from "./treeUnlinkedAssets";
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

	it("collectLinkedAssetIdsForView zählt ownerIdRef zur View/Gruppe", () => {
		const withOwner = {
			...root,
			assets: {
				assets: [
					...root.assets.assets,
					{ id: "a-owned", ownerIdRef: "view1" },
				],
			},
		} as any;
		const linked = collectLinkedAssetIdsForView(withOwner, "view1");
		expect(linked.has("a-owned")).toBe(true);
	});

	it("collectUnlinkedAssetsForView liefert nur freie Assets", () => {
		const unlinked = collectUnlinkedAssetsForView(root, "view1");
		expect(unlinked.map((asset) => asset.id)).toEqual(["a-free"]);
	});

	it("collectUnlinkedElementsForView enthält freie View-Folder und Assets", () => {
		const withFreeFolder = {
			...root,
			views: { views: [{ id: "view1" }, { id: "view2" }] },
			groups: {
				groups: [
					...root.groups.groups,
					{ id: "g-free", parentIdRef: undefined, elementIdRefs: [] },
					{ id: "g-free-child", parentIdRef: "g-free", elementIdRefs: [] },
					{ id: "g-empty-parent", parentIdRef: "", elementIdRefs: [] },
					{ id: "g-other-view", parentIdRef: "view2", elementIdRefs: [] },
				],
			},
		} as any;
		expect(collectUnlinkedElementsForView(withFreeFolder, "view1").map((item) => item.id)).toEqual([
			"g-free",
			"g-empty-parent",
			"a-free",
		]);
	});

	it("gestapelte ownerIdRef-Kinder gelten als verknüpft", () => {
		const stackedRoot = {
			groups: {
				groups: [{ id: "g1", parentIdRef: "view1", elementIdRefs: [{ id: "a-parent" }] }],
			},
			assets: {
				assets: [
					{ id: "a-parent", ownerIdRef: null },
					{ id: "a-child", ownerIdRef: "a-parent" },
					{ id: "a-free", ownerIdRef: null },
				],
			},
		} as any;
		const linked = collectLinkedAssetIdsForView(stackedRoot, "view1");
		expect(linked.has("a-parent")).toBe(true);
		expect(linked.has("a-child")).toBe(true);
		expect(linked.has("a-free")).toBe(false);
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
