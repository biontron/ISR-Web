/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { Instance, types } from "mobx-state-tree";
import { BaseStore } from "./Base.Store";
import { ConfigModel } from "./Models/Config.Model";
import { ConnectionStore } from "./Connection.Store";
import { ConfigSchemaStore } from "./ConfigSchema.Store";
import { ViewStore } from "./View.Store";
import { GroupStore } from "./Group.Store";
import { AssetStore } from "./Asset.Store";
import { IaCStore } from "./IaC.Store";
import { initialUIStore, UIStore } from "./UI.Store";
import { I18NStoreModel } from "./i18n.Store";

/**
 * Our root store - the entry point for all data models in our application
 */
export const RootStore = types
	.compose(
		"Root",
		BaseStore,
		types.model({
			ui: types.optional(UIStore, initialUIStore),
			views: types.optional(ViewStore, {}),
			groups: types.optional(GroupStore, {}),
			assets: types.optional(AssetStore, {}),
			connections: types.optional(ConnectionStore, {}),
			config: types.optional(ConfigModel, {}),
			configSchemas: types.optional(ConfigSchemaStore, {}),
			iac: types.optional(IaCStore, {}),
			i18n: types.optional(I18NStoreModel, {}),
		})
	)
	.actions((self) => {
		/**
		 * Called after the store is created by MST. We will use this to load the initial data.
		 */
		function afterCreate() {
			// config is self loading
			// self.loadElements();
		}

		return {
			afterCreate,
		};
	});

// export a singleton instance of the root store
export const rootStore = RootStore.create({});

// Typescript type / interface export
export interface IRootStore extends Instance<typeof RootStore> {}
