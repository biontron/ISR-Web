/*
# SPDX-License-Identifier: GPL-2.0*/

import { Instance, types, getSnapshot, applySnapshot, getRoot } from "mobx-state-tree";
import {
	getValueByPath,
	setValueByPath,
	removeValueByPath,
	addValueByPath,
	appendValueToArrayByPath,
	moveArrayEntryByPath,
	moveMapEntryByPath,
} from "../../lib/path";
import { hasElementValidationOrStoreErrors } from "../../lib/elementValidationChecks";
import { tryAssetArrayAdd, tryAssetArrayRemove, tryAssetMstAppend } from "../../lib/assetSchemaMutations";
import { IRootStore } from "../Root.Store";
import { ISchemaItem } from "../Types/SchemaItem";
import { ISchemaGroupModel } from "./SchemaGroup.Model";
import { isArrayCollectionGroup } from "../../lib/schemaDeviation";

export type ElementStatus =
	| "new"
	| "edit"
	| "changed"
	| "invalid"
	| "deleted"
	| "untouched";

/** Schema: definition.tags[] mit Feld tag (kein string[]). */
export const ElementDefinitionTagModel = types.model("ElementDefinitionTag", {
	tag: types.optional(types.string, ""),
});

function markTouchedAfterMutation(self: { status: ElementStatus }): void {
	// Gleiche Regel wie nextTouchedStatus: new/invalid bleiben (REST create/POST).
	if (self.status === "new" || self.status === "invalid") {
		return;
	}
	if (self.status === "edit" || self.status === "untouched") {
		self.status = "changed";
	}
}

export const ElementModel = types
	.model("Element", {
		id: types.identifier,
	})
	.volatile(() => ({
		status: "untouched" as ElementStatus,
		statusBeforeInvalid: null as ElementStatus | null,
		editSnapshot: null as any,
		deleteSnapshot: null as any,
	}))
	.actions((self) => {
		function applyValidationSync(): void {
			const root = getRoot(self) as IRootStore;
			if (!root?.ui) {
				return;
			}
			if (root.ui.isReadOnly) {
				return;
			}
			// Selektion (untouched) nicht überschreiben — Entwürfe (new) validieren für Status invalid
			if (self.status === "untouched") {
				return;
			}

			const hasErrors = hasElementValidationOrStoreErrors(root, self as IElement);

			if (hasErrors) {
				if (self.status === "deleted") {
					return;
				}
				if (self.status !== "invalid") {
					self.statusBeforeInvalid = self.status;
					self.status = "invalid";
				}
				return;
			}

			if (self.status === "invalid") {
				const restore = self.statusBeforeInvalid ?? "changed";
				self.statusBeforeInvalid = null;
				self.status = restore;
			}
		}

		return {
			syncValidationStatus() {
				applyValidationSync();
			},

			setStatus(newStatus: ElementStatus) {
				console.log(`[ElementModel] setStatus → ${newStatus} (id: ${self.id})`);
				self.status = newStatus;
			},

			/** Nach Mutation: new/invalid bleiben, sonst changed. */
			markTouched() {
				markTouchedAfterMutation(self);
			},

			restoreStagingState(
				status: ElementStatus,
				statusBeforeInvalid: ElementStatus | null = null
			) {
				self.statusBeforeInvalid = statusBeforeInvalid;
				self.status = status;
			},

			beginEdit() {
				console.log(`[ElementModel] beginEdit aufgerufen (id: ${self.id})`);
				if (self.status === "edit" || self.status === "changed" || self.status === "invalid") {
					console.log("→ bereits im Edit-Modus, breche ab");
					return;
				}
				if (self.status === "new") {
					if (!self.editSnapshot) {
						self.editSnapshot = getSnapshot(self);
					}
					applyValidationSync();
					return;
				}
				self.editSnapshot = getSnapshot(self);
				console.log("[ElementModel] Snapshot gespeichert:", self.editSnapshot);
				self.status = "edit";
				applyValidationSync();
			},

			rollbackEdit() {
				console.log(`[ElementModel] rollbackEdit aufgerufen (id: ${self.id})`);
				console.log("Hat Snapshot?", !!self.editSnapshot);

				self.statusBeforeInvalid = null;

				if (!self.editSnapshot) {
					console.warn("⚠️ Kein Snapshot vorhanden → kann nicht zurücksetzen");
					self.status = "untouched";
					return;
				}

				try {
					console.log("→ Führe applySnapshot aus...");
					applySnapshot(self, self.editSnapshot);
					self.editSnapshot = null;
					self.status = "untouched";
					console.log("✅ Rollback erfolgreich");
				} catch (error) {
					console.error("❌ Fehler beim Rollback:", error);
					self.status = "untouched";
				}
			},

			commitEdit() {
				console.log(`[ElementModel] commitEdit (id: ${self.id})`);
				self.editSnapshot = null;
				self.deleteSnapshot = null;
				self.statusBeforeInvalid = null;
				self.status = "untouched";
			},

			commitLocalEdit() {
				if (self.status === "edit") {
					self.status = "changed";
				}
			},

			stageDelete() {
				if (self.status === "new") {
					return;
				}
				if (!self.deleteSnapshot) {
					self.deleteSnapshot = getSnapshot(self);
				}
				self.status = "deleted";
			},

			clearDeleteStaging() {
				self.deleteSnapshot = null;
				self.status = "untouched";
			},

			setValueByPath(path: string, value: any) {
				setValueByPath(self, path, value);
				markTouchedAfterMutation(self);
				applyValidationSync();
			},

			addValueByPath(pathPrefix: string, path: string, schemaItem: ISchemaGroupModel) {
				const root = getRoot(self) as IRootStore;
				const elementClass = (self as IElement).class;

				if (elementClass === "Asset" && isArrayCollectionGroup(schemaItem)) {
					const result = tryAssetArrayAdd(self as any, path, schemaItem, root);
					if (result === "choose" || result === undefined) {
						return;
					}
					if (tryAssetMstAppend(self as any, path, result)) {
						markTouchedAfterMutation(self);
						applyValidationSync();
						return;
					}
				}

				addValueByPath(self as any, pathPrefix, path, schemaItem, self);
				markTouchedAfterMutation(self);
				applyValidationSync();
			},

			addSchemaDefinitionItemByPath(path: string, item: Record<string, unknown>) {
				appendValueToArrayByPath(self as any, path, item);
				markTouchedAfterMutation(self);
				applyValidationSync();
			},

			removeValueByPath(path: string, index: number = NaN) {
				if ((self as IElement).class === "Asset" && tryAssetArrayRemove(self as any, path, index)) {
					markTouchedAfterMutation(self);
					applyValidationSync();
					return;
				}
				removeValueByPath(self as any, path, index);
				markTouchedAfterMutation(self);
				applyValidationSync();
			},

			moveArrayEntryByPath(path: string, fromIndex: number, delta: -1 | 1) {
				moveArrayEntryByPath(self as any, path, fromIndex, delta);
				markTouchedAfterMutation(self);
				applyValidationSync();
			},

			moveMapEntryByPath(path: string, key: string, delta: -1 | 1) {
				moveMapEntryByPath(self as any, path, key, delta);
				markTouchedAfterMutation(self);
				applyValidationSync();
			},
		};
	})
	.views((self) => ({
		get class(): string {
			return "Element";
		},
	}));

export type IElement = Instance<typeof ElementModel>;

export default ElementModel;