/*
# SPDX-License-Identifier: GPL-2.0*/

import { Instance, types } from "mobx-state-tree";

/**
 * Global config object for user specific defaults
 */
export const ConfigModel = types.model("Config", {
	lang: types.optional(types.string, "de"),
	username: types.optional(types.string, ""),
	domain: types.optional(types.string, ""),
	environment: types.optional(types.string, "01e93fa0-1c74-44b1-bafd-6d8a988fea01"),
	// the current selected view can be found ast UI.Store
	apihost: types.optional(types.string, "https://isr.biontron.com/api")

}).actions(self => {

	/**
	 * Called after the store is created by MST. We will use this to load the initial data.
	 */
	function afterCreate() {
		// set default language (browser language);
		self.lang = navigator.language;
	}

	return {
		afterCreate
	};
});

// Typescript type / interface export
export interface IConfig extends Instance<typeof ConfigModel> {}