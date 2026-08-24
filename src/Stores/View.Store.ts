/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { Instance, flow, getRoot, types } from "mobx-state-tree";
import { IConfig } from "./Models/Config.Model";
import { ViewModel, IView } from "./Models/View.Model";
import { BaseStore } from "./Base.Store";
import { ActiveElement } from "../Interfaces/Element";
import authStore from "./Auth.Store";
import { generateResourceID } from "../lib/common";
import { IRootStore } from "./Root.Store";
import { resolveViewDefinitionTypesForCreate } from "../lib/elementDefinitionTypes";
import { isNewElementStatus } from "../lib/elementStaging";
import api from "../lib/api";
import {
	createRestLoadFailureReport,
	enrichRestLoadReport,
	loadRestArrayIntoStore,
	publishRestLoadReport,
} from "../lib/restSnapshot";

/**
 * Our views store - this will have all the views, which are essentially the entry points to the trees
 */
export const ViewStore = types.compose("ViewStore", BaseStore, types.model({
	views: types.array(ViewModel)
}).actions(self => {

	function afterCreate() {
		// load();
	}

	/**
	 * Loader for the views (tree entry points)
	 */
	const load = flow(function* loadViews() {
		const domain = authStore.getDomain();
		if (!domain) {
			return;
		}

		try {
			const jsonData = yield api.getViews(domain);
			const report = enrichRestLoadReport(
				loadRestArrayIntoStore(self.views, ViewModel, jsonData, "View", { domain }),
				"View",
				domain
			);
			publishRestLoadReport(report);
		} catch (error) {
			publishRestLoadReport(createRestLoadFailureReport("View", error, { domain }));
		}
	});

	function create(schemaId: string) {
		const id = generateResourceID("View");
		const root = getRoot(self) as IRootStore;
		const schema = root.configSchemas.findSchemaById(schemaId);
		if (!schema) {
			throw new Error(`View-Schema '${schemaId}' nicht gefunden.`);
		}
		const definitionTypes = resolveViewDefinitionTypesForCreate(schema);

		const newView = ViewModel.create({
			id: id,
			definition: {
				storeType: definitionTypes.storeType,
				baseType: definitionTypes.baseType,
				type: definitionTypes.type,
				subType: definitionTypes.subType,
				name: "A new View",
				description: ""
			},
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

		console.log("View.Store - created new '" + schemaId + "' based on Template ", newView);
		self.views.push(newView);
		newView.setStatus("new");
		return newView;
	}

	// Add a save action
	const store = flow(function* saveData(viewID: string) {
		const root = getRoot(self) as any;
		const config = root.config as IConfig;

		if (viewID === undefined) {
			// nothing to do
		} else {
			try {
				// Replace with your save logic (e.g., sending data to a server)
				const data = self.views.find(view => view.id === viewID);
				const isCreate = isNewElementStatus(data?.status, data?.statusBeforeInvalid);
				const url = `/${authStore.getDomain()}/views${isCreate ? "" : "/" + viewID}`;

				const response = yield api.request(url, {
					method: isCreate ? "POST" : "PUT",
					body: JSON.stringify(data),
				});

				if (response.ok) {
					// Handle success
					data?.setStatus("untouched");
					console.log("View saved successfully.");
				} else {
					const responseBody = yield response.text();
					alert("Fehler beim Speichern der Gruppendaten: " + response.statusText + responseBody);
					console.error("Fehler beim Speichern der Gruppendaten: " + response.statusText, responseBody);
				}
			} catch (error) {
				alert("Unbekannter Fehler beim Speichern der View");
				console.error("Error saving data:", error);
			}
		}
	});

	function removeLocal(view: IView) {
		const entry = self.views.find((item) => item.id === view.id) ?? view;
		if (self.views.includes(entry)) {
			self.views.remove(entry);
		}
	}

	const remove = flow(function* removeView(viewId: string) {
		const root = getRoot(self) as any;
		const config = root.config as IConfig;
		try {
			const view = root.views.views.find(
				(view: IView) => view.id === viewId
			);
			const url = `/${authStore.getDomain()}/views/${viewId}`;

			const response = yield api.delete(url);

			if (response.ok) {
				removeLocal(view);
				console.log("View removed successfully.");
			} else {
				const responseBody = yield response.text();
				alert(
					"Fehler beim Löschen der View: " +
						response.statusText +
						responseBody
				);
				console.error(
					"Fehler beim Löschen der View: " + response.statusText,
					responseBody
				);
			}
		} catch (error) {
			alert("Unbekannter Fehler beim Löschen der View");
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
export interface IViewsStore extends Instance<typeof ViewStore> {};