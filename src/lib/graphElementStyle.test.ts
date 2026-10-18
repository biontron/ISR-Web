import { types } from "mobx-state-tree";
import { DEFAULT_GRAPH_CONFIG } from "./graphConfig";
import { readElementGraphTags, resolveGraphStyle } from "./graphElementStyle";

describe("graphElementStyle", () => {
	it("uses legacy bgColor as fill override", () => {
		const style = resolveGraphStyle(
			{
				class: "Group",
				properties: {
					style: {
						bgColor: "#aabbcc",
						graph: { layout: "MAIN" },
					},
				},
			},
			{ config: DEFAULT_GRAPH_CONFIG }
		);
		expect(style.fill).toBe("#aabbcc");
	});

	it("uses container preset when bgColor empty", () => {
		const style = resolveGraphStyle(
			{
				class: "Group",
				properties: {
					style: {
						bgColor: "",
						graph: { layout: "GROUP" },
					},
				},
			},
			{ config: DEFAULT_GRAPH_CONFIG }
		);
		expect(style.fill).toBe("#eeeeff");
		expect(style.strokeDasharray).toBe("5");
	});

	it("reads hashtags from definition.tags", () => {
		expect(
			readElementGraphTags({
				class: "Asset",
				definition: { tags: ["#prod", "#dmz"] },
			})
		).toEqual(["#prod", "#dmz"]);
	});

	it("reads hashtags from definition.tags objects", () => {
		expect(
			readElementGraphTags({
				class: "Group",
				definition: { tags: [{ tag: "#prod" }, { tag: "#dmz" }] },
			})
		).toEqual(["#prod", "#dmz"]);
	});

	it("reads legacy map shape definition.tags.tag", () => {
		expect(
			readElementGraphTags({
				class: "Asset",
				definition: { tags: { tag: "#service" } },
			})
		).toEqual(["#service"]);
	});

	it("reads hashtags from an MST tags array", () => {
		const Model = types.model({
			definition: types.model({
				tags: types.optional(
					types.array(types.model({ tag: types.optional(types.string, "") })),
					[]
				),
			}),
		});
		const node = Model.create({
			definition: { tags: [{ tag: "#Bike" }, { tag: "#dmz" }] },
		});
		expect(readElementGraphTags(node)).toEqual(["#Bike", "#dmz"]);
	});
});
