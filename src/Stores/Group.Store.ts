/*
# SPDX-License-Identifier: GPL-2.0*/

import { Instance, flow, getRoot, getSnapshot, types, SnapshotIn } from "mobx-state-tree";
import { BaseStore, IBaseStore } from "./Base.Store";
import { GroupModel, IGroup } from "./Models/Group.Model";
import { IConfig } from "./Models/Config.Model";
import { ActiveElement } from "../Interfaces/Element";
import authStore from "./Auth.Store";
import { toJS } from "mobx";
import { generateResourceID } from "../lib/common";
import { IRootStore } from "./Root.Store";
import { resolveGroupDefinitionTypesForCreate } from "../lib/elementDefinitionTypes";
import {
	captureElementStagingState,
	isTouchedStatus,
	restoreElementStagingState,
} from "../lib/elementStaging";
import api from "../lib/api";
import {
	createRestLoadFailureReport,
	enrichRestLoadReport,
	loadRestArrayIntoStore,
	publishRestLoadReport,
} from "../lib/restSnapshot";

interface PendingGroupRestoreEntry {
	snapshot: SnapshotIn<typeof GroupModel>;
	staging: ReturnType<typeof captureElementStagingState>;
}

function snapshotPendingGroups(groups: readonly IGroup[]): PendingGroupRestoreEntry[] {
	return groups
		.filter((group) => isTouchedStatus(group.status))
		.map((group) => ({
			snapshot: getSnapshot(group),
			staging: captureElementStagingState(group),
		}));
}

function restorePendingGroups(
	target: { push: (item: IGroup) => void; some: (fn: (group: IGroup) => boolean) => boolean },
	pendingEntries: PendingGroupRestoreEntry[]
) {
	for (const entry of pendingEntries) {
		if (target.some((group) => group.id === entry.snapshot.id)) {
			continue;
		}
		try {
			const group = GroupModel.create(entry.snapshot);
			restoreElementStagingState(group, entry.staging);
			target.push(group);
		} catch (error) {
			console.error(
				"Pending Group konnte nach REST-Load nicht wiederhergestellt werden:",
				entry.snapshot.id,
				error
			);
		}
	}
}

/**
 * Our group store - this will have all the groups which belong to a certain view.
 * This will generate a tree based on the parent IDs wihtin the group models
 */


export const GroupStore = types.compose("GroupStore", BaseStore, types.model({
	groups: types.optional(types.array(GroupModel), []),
}).actions(self => {
	let loadInFlight: Promise<void> | null = null;

	function afterCreate() {
		// load();
	}

	/**
	 * Loader for a single views content
	 */
	const load = flow(function* loadGroups(viewID: string) {
		if (loadInFlight) {
			yield loadInFlight;
			return;
		}

		let resolveLoad!: () => void;
		let rejectLoad!: (error: unknown) => void;
		loadInFlight = new Promise<void>((resolve, reject) => {
			resolveLoad = resolve;
			rejectLoad = reject;
		});

		const baseSelf = self as unknown as IBaseStore;
		const root = getRoot(self) as any;
		console.log("Group load with view=" + viewID);
		const domain = authStore.getDomain();

		baseSelf.loading = true;
		try {
			const pendingGroupSnapshots = snapshotPendingGroups(self.groups);
			if (domain) {
				const restUrlIds = { viewId: viewID };
				try {
					const jsonData = yield api.getGroups(domain, viewID);
					const report = enrichRestLoadReport(
						loadRestArrayIntoStore(self.groups, GroupModel, jsonData, "Group", {
							domain,
							restUrlIds,
						}),
						"Group",
						domain,
						restUrlIds
					);
					publishRestLoadReport(report);
					restorePendingGroups(self.groups, pendingGroupSnapshots);
				} catch (error) {
					publishRestLoadReport(
						createRestLoadFailureReport("Group", error, { domain, restUrlIds })
					);
				}
			}
			root.ui.rebindActiveElement();
			resolveLoad();
		} catch (error) {
			rejectLoad(error);
		} finally {
			baseSelf.loading = false;
			loadInFlight = null;
		}
	});

	// Add a save action
	const store = flow(function* saveData(viewID: string, groupID: string) {

		if (viewID === undefined) {
			// nothing to do
		} else {
			try {
				// Replace with your save logic (e.g., sending data to a server)
				const data = self.groups.find(group => group.id === groupID);
				// /api/{$env.Domain}/views/{$env.ViewId}/groups/{$env.GroupId}
				const url = `/${authStore.getDomain()}/views/${viewID}/groups${
					data?.status !== "new" ? "/" + groupID : ""
				}`;

				const response = yield api.request(url, {
					method: data?.status !== "new" ? "PUT" : "POST",
					body: JSON.stringify(data),
				});

				if (response.ok) {
					// Handle success
					data?.setStatus("untouched");
					console.log("Group saved successfully.");
				} else {
					const responseBody = yield response.text();
					alert("Fehler beim Speichern der Gruppendaten: " + response.statusText + responseBody);
					console.error("Fehler beim Speichern der Gruppendaten: " + response.statusText, responseBody);
				}
			} catch (error) {
				alert("Unbekannter Fehler beim Speichern der Gruppe");
				console.error("Error saving data:", error);
			}
		}
	});

	function create(schemaId: string, parent: ActiveElement) {
		const id = generateResourceID("Group");
		const root = getRoot(self) as IRootStore;
		const schema = root.configSchemas.findSchemaById(schemaId);
		if (!schema) {
			throw new Error(`Group-Schema '${schemaId}' nicht gefunden.`);
		}
		const definitionTypes = resolveGroupDefinitionTypesForCreate(schema);

		const newGroup = GroupModel.create({
			id: id,
			definition: {
				storeType: definitionTypes.storeType,
				baseType: definitionTypes.baseType,
				type: definitionTypes.type,
				subType: definitionTypes.subType,
				name: root.i18n.text("general.element_new_group"),
				label: root.i18n.text("general.element_new_group"),
				description: ""
			},
			parentIdRef: parent?.id,
			elementIdRefs: [],
			filterRules: [],
			attachments: [],
			properties: {
				responsibles: [],
				notations: [],
				style: {
					bgColor: "",
					graph: {
						layout: null
					}
				},
			}
		});

		// newGroup.definition.baseType = schema;
		// newGroup.setBaseType(schema);
		console.log("Group.Store - created new '" + schemaId + "' ", toJS(newGroup));
		newGroup.setStatus("new");
		self.groups.push(newGroup);
		return newGroup;
	}

	function removeLocal(group: IGroup) {
		const entry = self.groups.find((item) => item.id === group.id) ?? group;
		if (self.groups.includes(entry)) {
			self.groups.remove(entry);
		}
	}

	const remove = flow(function* removeGroup(groupId: string) {
		const root = getRoot(self) as any;
		const config = root.config as IConfig;
		try {
			const group = root.groups.groups.find(
				(group: IGroup) => group.id === groupId
			);
			const url = `/${authStore.getDomain()}/views/${root.ui.activeView.id}/groups/${groupId}`;

			const response = yield api.delete(url);

			if (response.ok) {
				removeLocal(group);
				console.log("Group removed successfully.");
			} else {
				const responseBody = yield response.text();
				alert(
					"Fehler beim Löschen der Gruppe: " +
						response.statusText +
						responseBody
				);
				console.error(
					"Fehler beim Löschen der Gruppe: " + response.statusText,
					responseBody
				);
			}
		} catch (error) {
			alert("Unbekannter Fehler beim Löschen der Gruppe");
			console.error("Error deleting data:", error);
		}
	});

	return {
		load,
		create,
		store,
		remove,
		removeLocal
	};
}));

// Typescript type / interface export
export interface IGroupStore extends Instance<typeof GroupStore> {}