import { Instance, types } from "mobx-state-tree";

export const BaseModel = types.model({}).actions(self => {
	return {};
});

// Typescript Export
export interface IBase extends Instance<typeof BaseModel> {}