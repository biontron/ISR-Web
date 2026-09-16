import { Instance, types } from "mobx-state-tree";

/** REST/XSD `ElementIdRefType`: environmentId, id, baseType, type, subType, name, label. */
export const ElementIdRefModel = types.model("ElementIdRef", {
	environmentId: types.optional(types.string, ""),
	id: types.string,
	baseType: types.optional(types.string, ""),
	type: types.optional(types.string, ""),
	subType: types.optional(types.string, ""),
	name: types.optional(types.string, ""),
	label: types.optional(types.string, ""),
});

export type IElementIdRef = Instance<typeof ElementIdRefModel>;
