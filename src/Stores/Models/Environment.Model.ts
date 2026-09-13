/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0
*/
import { Instance, types } from "mobx-state-tree";

export const EnvironmentModel = types
	.model("Environment", {
		id: types.identifier,
		definition: types.optional(
			types.model({
				baseType: types.optional(types.string, "ENVIRONMENT"),
				subType: types.optional(types.string, ""),
				name: types.optional(types.string, ""),
			}),
			{}
		),
		properties: types.optional(
			types.model({
				bgColor: types.optional(types.string, ""),
				responsibles: types.optional(types.frozen(), []),
				notations: types.optional(types.frozen(), []),
			}),
			{}
		),
	})
	.actions((self) => ({
		setName(name: string) {
			self.definition.name = name;
		},
	}));

export interface IEnvironment extends Instance<typeof EnvironmentModel> {}

export function environmentDisplayName(environment?: IEnvironment | null): string {
	const name = environment?.definition?.name?.trim();
	if (name) {
		return name;
	}
	return environment?.id ?? "—";
}
