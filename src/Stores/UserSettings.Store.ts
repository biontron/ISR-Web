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

function emptySettings(name: string) {
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
		.actions((self) => {
			const base = self as unknown as IBaseStore;

			function setError(message?: string, code = 0) {
				base.error = message ? { message, code } : undefined;
			}

			function setLoading(value: boolean) {
				base.loading = value;
			}

		const load = flow(function* loadUserSettings() {
			const domain = authStore.getDomain();
			const username = authStore.username ?? "";
			setLoading(true);
			setError();
			if (!domain || !username) {
				applySnapshot(self.settings, emptySettings(username));
				setLoading(false);
				return;
			}
			try {
				const json = yield api.getUserSettings(domain, username);
				applySnapshot(self.settings, json);
			} catch (error) {
				applySnapshot(self.settings, emptySettings(username));
				if (!(error instanceof RestRequestError && error.status === 404)) {
					setError(
						error instanceof Error ? error.message : String(error),
						error instanceof RestRequestError ? error.status : 0
					);
				}
			} finally {
				setLoading(false);
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
			try {
				const json = yield api.putUserSettings(domain, username, getSnapshot(self.settings));
				applySnapshot(self.settings, json);
				setLoading(false);
				return true;
			} catch (error) {
				setError(
					error instanceof Error ? error.message : String(error),
					error instanceof RestRequestError ? error.status : 0
				);
				setLoading(false);
				return false;
			}
		});

		function setPublicKey(value: string) {
			self.settings.publicKey = value;
		}

		function setPrivateKey(value: string) {
			self.settings.privateKey = value;
		}

		function applyKeyPair(publicKey: string, privateKey: string) {
			self.settings.publicKey = publicKey;
			self.settings.privateKey = privateKey;
		}

		return { load, save, setPublicKey, setPrivateKey, applyKeyPair, setError };
	});

export interface IUserSettingsStore extends Instance<typeof UserSettingsStore> {}
