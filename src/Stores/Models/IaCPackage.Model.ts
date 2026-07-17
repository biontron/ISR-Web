import { Instance, types } from "mobx-state-tree";

export const IaCPackageModel = types.model("IaCPackage", {
	name: types.identifier,
	uri: types.maybe(types.string),
});

export type IIaCPackage = Instance<typeof IaCPackageModel>;
