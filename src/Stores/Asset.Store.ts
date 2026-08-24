/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { Instance, applySnapshot, flow, types, getRoot } from "mobx-state-tree";
import { BaseStore } from "./Base.Store";
import { IRootStore } from "./Root.Store";
import { ConnectionStore } from "./Connection.Store";
import { ActiveElement } from "../Interfaces/Element";
import { AssetModel, IAsset } from "./Models/Asset.Model";
import { IConfig } from "./Models/Config.Model";
import authStore from "./Auth.Store";
import { AssetDetailsModel } from "./Models/AssetDetails.Model";
import { generateResourceID } from "../lib/common";
import api from "../lib/api";
import {
	createRestLoadFailureReport,
	enrichRestLoadReport,
	loadRestArrayIntoStore,
	normalizeRestArray,
	publishRestLoadReport,
} from "../lib/restSnapshot";
import { ISchemaModel } from "./Models/Schema.Model";
import { resolveComponentDefinitionTypesForCreate } from "../lib/elementDefinitionTypes";
import { isNewElementStatus } from "../lib/elementStaging";


/**
 * Asset Store
 */
export const AssetStore = types.compose("Asset", BaseStore, types.model({
	assets: types.array(AssetModel),
	assetDetails: types.optional(types.array(AssetDetailsModel), [])
})).actions(self => {

	/**
	 * Called after the store is created by MST.
	 * Assets werden über den Router-Loader geladen (kein doppeltes loadAssets hier).
	 */
	function afterCreate() {
	}

	// Add a save action
	const store = flow(function* saveData(viewID: string, assetID: string) {
		const root = getRoot(self) as any;
		const config = root.config as IConfig;

		if (viewID === undefined) {
			// nothing to do
		} else {
			try {
				// Replace with your save logic (e.g., sending data to a server)
				const data = self.assets.find(asset => asset.id === assetID);
				const isCreate = isNewElementStatus(data?.status, data?.statusBeforeInvalid);
				const url = `/${authStore.getDomain()}/environments/${config.environment}/assets${
					isCreate ? "" : "/" + assetID
				}`;

				const response = yield api.request(url, {
					method: isCreate ? "POST" : "PUT",
					body: JSON.stringify(data),
				});

				if (response.ok) {
					// Handle success
					data?.setStatus("untouched");
					console.log("Asset saved successfully.");
				} else {
					const responseBody = yield response.text();
					alert("Fehler beim Speichern der Assetdaten: " + response.statusText + responseBody);
					console.error("Fehler beim Speichern der Assetdaten: " + response.statusText, responseBody);
				}
			} catch (error) {
				alert("Unbekannter Fehler beim Speichern des Asset");
				console.error("Error saving data:", error);
			}
		}
	});

	/**
	 * Loader for a single container content, types as any because of cyclic reference
	 */
	const loadAssets = flow(function* loadContent() {
		if (self.loading) {
			return;
		}

		self.loading = true;
		const root = getRoot(self) as any;
		const config = root.config as IConfig;
		const domain = authStore.getDomain();

		const restUrlIds = { env: config.environment };
		try {
			if (!domain) {
				return;
			}

			const jsonData = yield api.getAssets(domain, config.environment);
			const { items } = normalizeRestArray(jsonData);
			const report = enrichRestLoadReport(
				loadRestArrayIntoStore(self.assets, AssetModel, items, "Asset", {
					domain,
					restUrlIds,
				}),
				"Asset",
				domain,
				restUrlIds
			);
			publishRestLoadReport(report);

			const viewId = root.ui.activeView?.id;
			if (viewId) {
				yield root.groups.load(viewId);
			} else {
				root.ui.rebindActiveElement();
			}
		} catch (error) {
			if (domain) {
				publishRestLoadReport(
					createRestLoadFailureReport("Asset", error, { domain, restUrlIds })
				);
			}
		} finally {
			self.loading = false;
		}
	});

	/**
	 * Loads the details of the assets belonging to active container in the ui store
	 */
	const loadAssetDetails = flow(function* loadAssetDetails() {
		// self.loading = true;
		const root = getRoot(self) as IRootStore;
		const config = root.config as IConfig;
		/*
		const url = `${authStore.getApiRoot()}/${authStore.getDomain()}/environments/${config.environment}-list`;
		const idList = JSON.stringify(rootStore.ui.activeGroup?.assetIds);

		if (rootStore.ui.activeGroup?.assetIds.length !== 0) {
			const response = yield fetch(url, {
				method: "POST",
				headers: {
					Accept: "application/json",
					Authorization: AUTHORIZATION
				},
				body: idList
			});

			if (response.status >= 200 && response.status < 300) {
				const json = yield response.json();
				applySnapshot(self.assetDetails, json);
			// console.log("ASSET Details", json);
			} else {

			}
		} else {
			return [];
		}
		*/

		// self.loading = false;
	});

	function create(schemaId: string, parent: ActiveElement) {
		const id = generateResourceID("Asset");
		const root = getRoot(self) as IRootStore;
		const schema =
			root.configSchemas.findSchemaById(schemaId) ??
			root.configSchemas.getSchema("COMPONENT", schemaId);
		if (!schema) {
			throw new Error(`Component-Schema '${schemaId}' nicht gefunden.`);
		}
		const definitionTypes = resolveComponentDefinitionTypesForCreate(schema as ISchemaModel);

		const newAsset = AssetModel.create({
			id: id,
			definition: {
				storeType: definitionTypes.storeType,
				baseType: definitionTypes.baseType,
				type: definitionTypes.type,
				subType: definitionTypes.subType,
				name: root.i18n.text("general.element_new_component"),
				label: root.i18n.text("general.element_new_component"),
				description: ""
			},
			ownerIdRef: parent?.id,
			docks: [],
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

		console.log("Asset.Store - created new '" + schemaId + "' based on Template ", newAsset);
		self.assets.push(newAsset);
		newAsset.setStatus("new");
		return newAsset;
	}

	function removeLocal(asset: IAsset) {
		const entry = self.assets.find((item) => item.id === asset.id) ?? asset;
		if (self.assets.includes(entry)) {
			self.assets.remove(entry);
		}
	}

	const remove = flow(function* removeAsset(assetId: string) {
		const root = getRoot(self) as any;
		const config = root.config as IConfig;

		try {
			const asset = root.assets.assets.find((asset: IAsset) => asset.id === assetId);
			const url = `/${authStore.getDomain()}/environments/${config.environment}/assets/${assetId}`;

			const response = yield api.delete(url);

			if (response.ok) {
				removeLocal(asset);
				console.log("Asset removed successfully.");
			} else {
				const responseBody = yield response.text();
				alert("Fehler beim Löschen des Asset: " + response.statusText + responseBody);
				console.error("Fehler beim Löschen des Asset: " + response.statusText, responseBody);
			}
		} catch (error) {
			alert("Unbekannter Fehler beim Löschen des Asset");
			console.error("Error deleting data:", error);
		}
	});

	function findAssetByDockpartId(dockpartId: string) {
		return self.assets.find((asset) =>
			asset.docks.some((dock) =>
				dock.dockparts.some((part) => String(part.id) === String(dockpartId))
			)
		);
	}

	return {
		loadAssetDetails,
		loadAssets,
		findAssetByDockpartId,
		create,
		store,
		remove,
		removeLocal
	};

});

// export a singleton instance of the asset store
export const assetStore = AssetStore.create({});

// Typescript type / interface export
export interface IAssetStore extends Instance<typeof AssetStore> {} ;
