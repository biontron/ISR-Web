/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0
*/
import { flow, getRoot, Instance, types } from "mobx-state-tree";
import { BaseStore } from "./Base.Store";
import { EnvironmentModel, IEnvironment } from "./Models/Environment.Model";
import type { IRootStore } from "./Root.Store";
import authStore from "./Auth.Store";
import api from "../lib/api";
import { generateResourceID } from "../lib/common";
import {
	createRestLoadFailureReport,
	enrichRestLoadReport,
	loadRestArrayIntoStore,
	normalizeRestArray,
	publishRestLoadReport,
} from "../lib/restSnapshot";
import { readViewEnvironmentBindings } from "../lib/viewEnvironments";

export const EnvironmentStore = types.compose(
	"EnvironmentStore",
	BaseStore,
	types
		.model({
			environments: types.optional(types.array(EnvironmentModel), []),
		})
		.views((self) => ({
			findById(id: string): IEnvironment | undefined {
				return self.environments.find((environment) => environment.id === id);
			},
		}))
		.actions((self) => {
			const load = flow(function* loadEnvironments() {
				const domain = authStore.getDomain();
				if (!domain) {
					return;
				}
				try {
					const jsonData = yield api.getEnvironments(domain);
					const { items } = normalizeRestArray(jsonData);
					const report = enrichRestLoadReport(
						loadRestArrayIntoStore(self.environments, EnvironmentModel, items, "Environment", {
							domain,
						}),
						"Environment",
						domain
					);
					publishRestLoadReport(report);
				} catch (error) {
					publishRestLoadReport(createRestLoadFailureReport("Environment", error, { domain }));
				}
			});

			function removeLocal(environment: IEnvironment) {
				const entry = self.environments.find((item) => item.id === environment.id) ?? environment;
				if (self.environments.includes(entry)) {
					self.environments.remove(entry);
				}
			}

			function unbindFromViews(environmentId: string) {
				const root = getRoot(self) as IRootStore;
				for (const view of root.views.views) {
					const bindings = readViewEnvironmentBindings(view);
					if (!bindings.some((entry) => entry.ref === environmentId)) {
						continue;
					}
					view.setEnvironments(bindings.filter((entry) => entry.ref !== environmentId));
				}
			}

			const create = flow(function* createEnvironment(name: string) {
				const domain = authStore.getDomain();
				const trimmed = name.trim();
				if (!domain || !trimmed) {
					return undefined;
				}
				const id = generateResourceID("Environment");
				const payload = {
					id,
					definition: {
						baseType: "ENVIRONMENT",
						subType: "",
						name: trimmed,
					},
					properties: {
						bgColor: "",
					},
				};
				try {
					const created = yield api.post(`/${domain}/environments`, payload);
					const environment = EnvironmentModel.create({
						id: created?.id ?? id,
						definition: {
							baseType: created?.definition?.baseType ?? "ENVIRONMENT",
							subType: created?.definition?.subType ?? "",
							name: created?.definition?.name ?? trimmed,
						},
						properties: {
							bgColor: created?.properties?.bgColor ?? "",
							ignoredDevices: Array.isArray(created?.properties?.ignoredDevices)
								? created.properties.ignoredDevices
								: [],
						},
					});
					self.environments.push(environment);
					return environment;
				} catch (error) {
					alert("Fehler beim Anlegen des Environment");
					console.error("Error creating environment:", error);
					return undefined;
				}
			});

			function environmentPayload(environment: IEnvironment, name = environment.definition.name) {
				return {
					id: environment.id,
					definition: {
						baseType: environment.definition.baseType,
						subType: environment.definition.subType,
						name,
					},
					properties: {
						bgColor: environment.properties.bgColor,
						ignoredDevices: environment.properties.ignoredDevices.slice(),
					},
				};
			}

			const persist = flow(function* persistEnvironment(environment: IEnvironment) {
				const domain = authStore.getDomain();
				if (!domain) {
					return;
				}
				yield api.put(`/${domain}/environments/${environment.id}`, environmentPayload(environment));
			});

			const rename = flow(function* renameEnvironment(environmentId: string, name: string) {
				const domain = authStore.getDomain();
				const environment = self.findById(environmentId);
				const trimmed = name.trim();
				if (!domain || !environment || !trimmed) {
					return;
				}
				environment.setName(trimmed);
				try {
					yield api.put(`/${domain}/environments/${environmentId}`, environmentPayload(environment, trimmed));
				} catch (error) {
					alert("Fehler beim Umbenennen des Environment");
					console.error("Error renaming environment:", error);
				}
			});

			const remove = flow(function* removeEnvironment(environmentId: string) {
				const domain = authStore.getDomain();
				const environment = self.findById(environmentId);
				if (!domain || !environment) {
					return;
				}
				try {
					const response = yield api.request(`/${domain}/environments/${environmentId}`, {
						method: "DELETE",
					});
					if (!response.ok) {
						const responseBody = yield response.text();
						alert("Fehler beim Löschen des Environment: " + response.statusText + responseBody);
						return;
					}
					unbindFromViews(environmentId);
					removeLocal(environment);
					const root = getRoot(self) as IRootStore;
					void root.assets.loadAssets();
					void root.connections.load();
				} catch (error) {
					alert("Fehler beim Löschen des Environment");
					console.error("Error deleting environment:", error);
				}
			});

			return { load, create, rename, persist, remove, removeLocal };
		})
);

export interface IEnvironmentStore extends Instance<typeof EnvironmentStore> {}
