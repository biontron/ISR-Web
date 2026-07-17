/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { flow } from "mobx";
import { types, getRoot, Instance } from "mobx-state-tree";
import authStore from "../Auth.Store";
import api from "../../lib/api";

export const EnvironmentModel = types.model("Environment", {
}).actions(self => {

	const load = flow(function* load() {
		// Explicit typing to avoid error with typescript / circular dependencies
		const url = `/${authStore.getDomain()}/environments`;
		const response = yield api.get(url);
		const json = yield response.json();
		// applySnapshot(self.views, json);

		console.log("json", json);
	});

	return {
		load
	};
});

// Typescript export
export type IEnvironment = Instance<typeof EnvironmentModel>;