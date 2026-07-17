/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { reaction } from "mobx";
import { Instance, types, getRoot } from "mobx-state-tree";
import { ViewModel, IView } from "./Models/View.Model";
import { GroupModel, IGroup } from "./Models/Group.Model";
import { AssetModel, IAsset } from "./Models/Asset.Model";
import { ConnectionModel } from "./Models/Connection.Model";
import { ViewLazyRef } from "./Models/View.Model";
import { resolveIdentifier } from "mobx-state-tree";
import { rootStore } from "./Root.Store";
import { ActiveElement } from "../Interfaces/Element";
import { IElement } from "./Models/Element.Model";

function runValidationSyncForElement(element: ActiveElement | undefined): void {
	if (!element) {
		return;
	}
	(element as IElement).syncValidationStatus();
}

/**
 * UI Store — zentraler UI-Zustand inkl. systemweitem Änderungsmodus (isReadOnly).
 */
export const UIStore = types
	.model("UIStore", {
		activeView: types.maybe(ViewLazyRef),
		activeElement: types.maybe(
			types.union(
				types.safeReference(types.late(() => ViewModel)),
				types.safeReference(types.late(() => GroupModel)),
				types.safeReference(types.late(() => AssetModel)),
				types.safeReference(types.late(() => ConnectionModel))
			)
		),
		lastActiveElementId: types.optional(types.string, ""),
		isReadOnly: types.boolean,
		selectedSchemaBaseType: types.optional(
			types.enumeration(["INTERNAL", "VIEWGROUP", "COMPONENT", "DOCKPART"]),
			"COMPONENT"
		),
		selectedConfigSchemaId: types.optional(types.string, ""),
	})
	.actions((self) => ({
		syncActiveElementValidation() {
			runValidationSyncForElement(self.activeElement);
		},

		/**
		 * Set the active view - we need to cast the string to any, because MST wont mismatch it otherwise
		 * @param {string} view
		 */
		setActiveView(view: any) {
			if (view !== self.activeView?.id) {
				console.log(
					"setActiveView from " + self.activeView?.id + " to " + view
				);

				self.activeView = view as any;

				// regarding view-specific elements (groups)
				const root = getRoot(self) as any;
				root.groups.load(view);
			}
		},

		/**
		 * Set the active element
		 * @param element
		 */
		setActiveElement(element: ActiveElement) {
			if (element) {
				self.lastActiveElementId = element.id;
				self.activeElement = element;
				runValidationSyncForElement(element);
			} else {
				self.lastActiveElementId = "";
				self.activeElement = undefined;
				console.log("setActiveElement - unset", element);
			}
		},

		/**
		 * Set the active element by ID
		 * @param elementId
		 */
		setActiveElementById(elementId: string) {
			if (elementId) {
				self.lastActiveElementId = elementId;
				// try to get the group or asset from the selected key
				const viewObj = resolveIdentifier(
					ViewModel,
					rootStore,
					elementId
				);
				const groupObj = resolveIdentifier(
					GroupModel,
					rootStore,
					elementId
				);
				const assetObj = resolveIdentifier(
					AssetModel,
					rootStore,
					elementId
				);
				const connectionObj = resolveIdentifier(
					ConnectionModel,
					rootStore,
					elementId
				);
				console.log(
					"setActiveElementById",
					elementId,
					viewObj,
					groupObj,
					assetObj
				);

				if (viewObj) {
					self.activeElement = viewObj;
					self.activeView = viewObj;
					runValidationSyncForElement(viewObj);
				} else if (assetObj) {
					self.activeElement = assetObj;
					runValidationSyncForElement(assetObj);
				} else if (groupObj) {
					self.activeElement = groupObj;
					runValidationSyncForElement(groupObj);
				} else if (connectionObj) {
					self.activeElement = connectionObj;
					runValidationSyncForElement(connectionObj);
				} else {
					self.activeElement = undefined;
					console.error(
						"setActiveElementById '" +
							elementId +
							"' - neither asset, nor group or even plain view object"
					);
				}
			} else {
				self.lastActiveElementId = "";
				self.activeElement = undefined;
				console.log("setActiveElementById - unset", elementId);
			}
		},

		rebindActiveElement() {
			if (self.lastActiveElementId) {
				this.setActiveElementById(self.lastActiveElementId);
			}
		},

		/**
		 * Setting up a reaction to the activeView property
		 */
		afterCreate() {
			// Setting up a reaction to the activeView property
			// When the activeView changes, we want to load its content (groups)
			reaction(
				() => self.activeView,
				(activeView, prevView) => {
					if (activeView && activeView !== prevView) {
						// activeView?.loadGroup();
						rootStore.groups.load(activeView.id);
					}
				}
			);
		},

		/**
		 * Nur-Lesen-Modus (GET only) — Änderungsmodus beendet
		 */
		enterReadOnlyMode() {
			self.isReadOnly = true;
		},

		/**
		 * Änderungsmodus aktivieren (CUD erlaubt)
		 */
		exitReadOnlyMode() {
			self.isReadOnly = false;
		},

		/**
		 * Toggle read-only mode
		 */
		toggleReadOnlyMode() {
			self.isReadOnly = !self.isReadOnly;
		},
		setSelectedSchemaBaseType(baseType: "INTERNAL" | "VIEWGROUP" | "COMPONENT" | "DOCKPART") {
			self.selectedSchemaBaseType = baseType;
		},
		setSelectedConfigSchemaId(schemaId: string) {
			self.selectedConfigSchemaId = schemaId;
		},
		clearSelectedConfigSchemaId() {
			self.selectedConfigSchemaId = "";
		},
	}))
	.views((self) => ({
		canEditActiveElement(): boolean {
			const status = self.activeElement?.status;
			return (
				!self.isReadOnly &&
				!!status &&
				["new", "edit", "changed", "invalid"].includes(status)
			);
		},
	}));

// Typescript type / interface export
export type IUIStore = Instance<typeof UIStore>;

export const initialUIStore = {
	isReadOnly: true,
	selectedSchemaBaseType: "COMPONENT" as const,
	selectedConfigSchemaId: "",
};
