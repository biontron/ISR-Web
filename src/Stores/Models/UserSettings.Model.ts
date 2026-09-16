/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0
*/
import { Instance, types } from "mobx-state-tree";

export const UserSettingsModel = types.model("UserSettings", {
	id: types.string,
	name: types.string,
	publicKey: types.string,
	privateKey: types.string,
});

export interface IUserSettings extends Instance<typeof UserSettingsModel> {}
