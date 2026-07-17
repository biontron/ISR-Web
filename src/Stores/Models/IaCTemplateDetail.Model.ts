import { Instance, types } from "mobx-state-tree";

export const IaCTemplateDetailModel = types.model("IaCTemplateDetail", {
	id: types.identifier,
	format: types.string,
	mimeType: types.string,
	filename: types.string,
	version: types.string,
	xmldata: types.maybe(types.string),
	texttemplate: types.maybe(types.string),

	// Neues Dataset Model
	dataset: types.optional(types.model({
		domain: types.maybe(types.string),
		environment: types.maybe(types.string),
		view: types.maybe(types.string),
		group: types.maybe(types.string),
		asset: types.maybe(types.string),
	}), {}),
});

export type IIaCTemplateDetail = Instance<typeof IaCTemplateDetailModel>;
