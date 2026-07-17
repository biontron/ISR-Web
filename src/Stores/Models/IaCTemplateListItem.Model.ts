import { Instance, types } from "mobx-state-tree";

export const IaCTemplateListItemModel = types.model("IaCTemplateListItem", {
	name: types.identifier,
	uri: types.string,
});

export type IIaCTemplateListItem = Instance<typeof IaCTemplateListItemModel>;
