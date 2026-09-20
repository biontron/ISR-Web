/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0
*/
import { Instance, applySnapshot, flow, getSnapshot, types } from "mobx-state-tree";
import { BaseStore } from "./Base.Store";
import type { IBaseStore } from "./Base.Store";
import { UserSettingsModel } from "./Models/UserSettings.Model";
import authStore from "./Auth.Store";
import api, { RestRequestError } from "../lib/api";
import { isUsablePublicKeyPem } from "../lib/rsaPem";
import { mergeUserSettingsSnapshot, type UserSettingsSnapshot } from "../lib/userSettingsSnapshot";

function emptySettings(name: string): UserSettingsSnapshot {
	return {
		id: "",
		name,
		publicKey: "",
		privateKey: "",
	};
}

export const UserSettingsStore = types
	.compose(
		"UserSettingsStore",
		BaseStore,
		types.model({
			settings: types.optional(UserSettingsModel, emptySettings("")),
		})
	)
	.volatile(() => ({
		keysDirty: false,
		loadGeneration: 0,
	}))
	.actions((self) => {
		const base = self as unknown as IBaseStore;

		function setError(message?: string, code = 0) {
			base.error = message ? { message, code } : undefined;
		}

		function setLoading(value: boolean) {
			base.loading = value;
		}

		function markKeysDirty() {
			self.keysDirty = true;
		}

		const load = flow(function* loadUserSettings() {
			const domain = authStore.getDomain();
			const username = authStore.username ?? "";
			const generation = self.loadGeneration + 1;
			self.loadGeneration = generation;
			setLoading(true);
			setError();
			if (!domain || !username) {
				if (!self.keysDirty) {
					applySnapshot(self.settings, emptySettings(username));
				}
				setLoading(false);
				return;
			}
			try {
				const json = yield api.getUserSettings(domain, username);
				if (generation !== self.loadGeneration || self.keysDirty) {
					return;
				}
				const fallback = getSnapshot(self.settings);
				applySnapshot(self.settings, mergeUserSettingsSnapshot(json, fallback));
				self.keysDirty = false;
			} catch (error) {
				if (generation !== self.loadGeneration) {
					return;
				}
				if (!self.keysDirty) {
					applySnapshot(self.settings, emptySettings(username));
				}
				if (!(error instanceof RestRequestError && error.status === 404)) {
					setError(
						error instanceof Error ? error.message : String(error),
						error instanceof RestRequestError ? error.status : 0
					);
				}
			} finally {
				if (generation === self.loadGeneration) {
					setLoading(false);
				}
			}
		});

		const save = flow(function* saveUserSettings() {
			const domain = authStore.getDomain();
			const username = authStore.username ?? "";
			setLoading(true);
			setError();
			if (!domain || !username) {
				setLoading(false);
				return false;
			}
			self.settings.name = username;
			const sent = getSnapshot(self.settings);
			self.loadGeneration += 1;
			const generation = self.loadGeneration;
			try {
				const json = yield api.putUserSettings(domain, username, sent);
				if (generation !== self.loadGeneration) {
					return isUsablePublicKeyPem(self.settings.publicKey);
				}
				applySnapshot(self.settings, mergeUserSettingsSnapshot(json, sent));
				self.keysDirty = false;
				setLoading(false);
				return true;
			} catch (error) {
				setError(
					error instanceof Error ? error.message : String(error),
					error instanceof RestRequestError ? error.status : 0
				);
				applySnapshot(self.settings, sent);
				setLoading(false);
				return false;
			}
		});

		function setPublicKey(value: string) {
			self.settings.publicKey = value;
			markKeysDirty();
		}

		function setPrivateKey(value: string) {
			self.settings.privateKey = value;
			markKeysDirty();
		}

		function applyKeyPair(publicKey: string, privateKey: string) {
			self.settings.publicKey = publicKey;
			self.settings.privateKey = privateKey;
			markKeysDirty();
		}

		function reset() {
			self.keysDirty = false;
			self.loadGeneration += 1;
			applySnapshot(self.settings, emptySettings(""));
			setError();
		}

		return { load, save, setPublicKey, setPrivateKey, applyKeyPair, setError, reset };
	});

export interface IUserSettingsStore extends Instance<typeof UserSettingsStore> {}
