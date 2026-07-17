/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { Instance, types } from "mobx-state-tree";
import type { RestLoadErrorEntry } from "../lib/restSnapshot";

/**
 * Used for global error handling
 */
export const ErrorModel = types.model("ErrorModel", {
	message: types.string,
	code: types.number
});

export const RestLoadErrorModel = types.model("RestLoadError", {
	objectKind: types.string,
	itemId: types.string,
	message: types.string,
});

/**
 * Baye Store with functionaliy for loading, error handling etc.
 */
export const BaseStore = types.model("BaseStore", {
	error: types.maybe(ErrorModel), // TODO: Maye have a global error store or queue
	loading: types.optional(types.boolean, false),
	loadErrors: types.optional(types.array(RestLoadErrorModel), []),
}).actions((self) => ({
	setLoadErrors(errors: RestLoadErrorEntry[]) {
		self.loadErrors.replace(errors);
	},
}));

/** Workaround for MST compose: inner action blocks do not expose BaseStore on `self` in TS. */
export function applyLoadErrors(store: unknown, errors: RestLoadErrorEntry[]): void {
	const node = store as IBaseStore;
	node.loadErrors.replace(errors);
}

// Typescript type / interface export
export interface IBaseStore extends Instance<typeof BaseStore> {}
