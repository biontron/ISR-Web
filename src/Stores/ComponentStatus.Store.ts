/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0
*/
import { flow, Instance, types } from "mobx-state-tree";
import api from "../lib/api";
import {
	createRestLoadFailureReport,
	loadRestArrayIntoStore,
	publishRestLoadReport,
} from "../lib/restSnapshot";

export const ComponentStatusModel = types.model("ComponentStatus", {
	componentId: types.identifier,
	status: types.string,
	timestamp: types.optional(types.string, ""),
	reportedBy: types.optional(types.string, ""),
	environmentId: types.optional(types.string, ""),
});

export interface IComponentStatus extends Instance<typeof ComponentStatusModel> {}

function componentStatusId(item: unknown): string {
	if (!item || typeof item !== "object") {
		return "";
	}
	const id = (item as { componentId?: unknown }).componentId;
	return typeof id === "string" ? id : "";
}

/**
 * Betriebsstatus je Component-ID.
 * Wird der Geräte- oder Funktions-Component nur zugeordnet, nicht in sie hineingeschrieben.
 */
export const ComponentStatusStore = types
	.model("ComponentStatusStore", {
		items: types.array(ComponentStatusModel),
		loading: types.optional(types.boolean, false),
	})
	.views((self) => ({
		statusFor(componentId: string | undefined): string | undefined {
			if (!componentId) {
				return undefined;
			}
			return self.items.find((item) => item.componentId === componentId)?.status;
		},
	}))
	.actions((self) => {
		function clear() {
			self.items.clear();
		}

		const loadForEnvironments = flow(function* loadForEnvironments(
			domain: string,
			environmentIds: string[]
		) {
			if (!domain || environmentIds.length === 0) {
				clear();
				return;
			}

			self.loading = true;
			const merged: unknown[] = [];
			const seen = new Set<string>();
			try {
				for (const environmentId of environmentIds) {
					const jsonData = yield api.getComponentStatuses(domain, environmentId);
					const items = Array.isArray(jsonData) ? jsonData : [];
					for (const item of items) {
						if (!item || typeof item !== "object") {
							continue;
						}
						const componentId = componentStatusId(item);
						if (!componentId || seen.has(componentId)) {
							continue;
						}
						seen.add(componentId);
						merged.push({
							...(item as Record<string, unknown>),
							componentId,
							environmentId,
						});
					}
				}

				const report = loadRestArrayIntoStore(self.items, ComponentStatusModel, merged, "ComponentStatus", {
					domain,
					restUrlIds: { env: environmentIds[0] },
					getItemId: componentStatusId,
				});
				publishRestLoadReport(report);
			} catch (error) {
				publishRestLoadReport(
					createRestLoadFailureReport("ComponentStatus", error, {
						domain,
						restUrlIds: { env: environmentIds[0] },
					})
				);
			} finally {
				self.loading = false;
			}
		});

		return { clear, loadForEnvironments };
	});

export interface IComponentStatusStore extends Instance<typeof ComponentStatusStore> {}
