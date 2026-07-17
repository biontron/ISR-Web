/*
# SPDX-License-Identifier: GPL-2.0*/
// File: ./src/Apps/AssetManagement/Components/ElementPropertiesDetailss.tsx

import { Button, Divider, Tooltip } from "antd";
import React, { Fragment } from "react";
import SchemaEditor from "../../../Components/Schema/SchemaEditor/SchemaEditor.Component";
import CardCollapse from "./CardCollapse.Component";
import { useLangtext } from "../../../lib/common";
import { rootStore } from "../../../Stores/Root.Store";
import { observer } from "mobx-react";
import { IAsset } from "../../../Stores/Models/Asset.Model";
import { isTreeElement } from "../../../Interfaces/Element";
import ElementChildMapping from "../../../Components/Schema/SchemaEditor/Mappings/ElementChildMapping.Component";
import AssetReferenceMapping from "../../../Components/Schema/SchemaEditor/Mappings/AssetReferenceMapping.Component";
import { buildElementStatusClass } from "../../../lib/elementStatusStyle";
import {
	hasElementSettingsValidationErrors,
} from "../../../lib/elementValidationChecks";
import { resolveElementSettingsSchemaName } from "../../../lib/elementDefinitionTypes";

interface ElementPropertiesDetailsProps {}

const ElementPropertiesDetails: React.FC<ElementPropertiesDetailsProps> = () => {
	const langtext = useLangtext();
	const { activeElement, isReadOnly } = rootStore.ui;

	const canEdit = rootStore.ui.canEditActiveElement();
	const settingsHasErrors =
		!!activeElement &&
		canEdit &&
		hasElementSettingsValidationErrors(rootStore, activeElement);
	const settingsBodyClass = buildElementStatusClass(
		"element-properties-section__body",
		settingsHasErrors ? "invalid" : undefined
	);


	const isAssetLike =
		activeElement?.class === "View" ||
		activeElement?.class === "Group" ||
		activeElement?.class === "Asset";

	const handleSwitchToEditMode = () => {
		if (activeElement && !isReadOnly) {
			activeElement.beginEdit();           // ← Jetzt über Model
		}
	};

	const handleStore = async () => {
		if (!activeElement) return;

		try {
			const viewId = rootStore.ui.activeView?.id;

			switch (activeElement.class) {
				case "View":
					await rootStore.views.store(activeElement.id);
					break;
				case "Group":
					if (viewId) await rootStore.groups.store(viewId, activeElement.id);
					break;
				case "Asset":
					if (viewId) await rootStore.assets.store(viewId, activeElement.id);
					break;
				default:
					console.warn("Speichern für diesen Element-Typ noch nicht implementiert");
			}

			activeElement.commitEdit();          // ← Sauberes Aufräumen
		} catch (error) {
			console.error("Fehler beim Speichern:", error);
		}
	};

	const handleReset = () => {
		if (activeElement) {
			activeElement.rollbackEdit();        // ← Jetzt robust über Model
		}
	};

	return (
		<Fragment>
			{/* Status-spezifische Buttons */}
			{(activeElement?.status === "edit" || activeElement?.status === "changed") && (
				<>
					<Button type="primary" onClick={handleStore}>
						{langtext("general.edit_store")}
					</Button>
					<Button onClick={handleReset}>{langtext("general.edit_reset")}</Button>
				</>
			)}

			{isAssetLike && (
				<>
					<Tooltip title={langtext("general.element_properties")}>
						<Divider>{langtext("general.element_properties")}</Divider>
					</Tooltip>

					{activeElement && (
						<>
							<SchemaEditor
								schemaName="ANY-DEFINITION"
								pathPrefix=""
								elementData={activeElement}
								canEdit={canEdit}
							/>
							<SchemaEditor
								schemaName="ANY-PROPERTIES"
								pathPrefix="properties"
								elementData={activeElement}
								canEdit={canEdit}
							/>
						</>
					)}
				</>
			)}

			{isAssetLike && isTreeElement(activeElement) && (
				<section className="element-properties-section">
					<Tooltip title={langtext("general.element_settings")}>
						<Divider>{langtext("general.element_settings")}</Divider>
					</Tooltip>
					<div className={settingsBodyClass}>
						<SchemaEditor
							schemaDefinition={rootStore.configSchemas.findSchemaForDefinition(
								activeElement.definition
							)}
							schemaName={resolveElementSettingsSchemaName(
								activeElement.definition,
								rootStore.configSchemas.schemaCompat
							)}
							pathPrefix="settings"
							elementData={activeElement}
							canEdit={canEdit}
						/>
					</div>
				</section>
			)}

			<Tooltip title={langtext("general.element_links")}>
				<Divider>{langtext("general.element_links")}</Divider>
			</Tooltip>

			{/* Group child Reference Assignment (Hierarchy) */}
			{activeElement && (activeElement.class === "View" || activeElement.class === "Group") && (
				<CardCollapse title={langtext("general.groupreference_assignment")}>
					<ElementChildMapping element={activeElement} />
				</CardCollapse>
			)}

			{/* Asset cross Reference Assignment (Stacking) */}
			{activeElement && (activeElement.class === "Group" || activeElement.class === "Asset") && (
				<CardCollapse title={langtext("general.assetreference_assignment")}>
					<AssetReferenceMapping element={activeElement} />
				</CardCollapse>
			)}

			{/* Button: In den Bearbeitungsmodus wechseln */}
			{!isReadOnly &&
				activeElement?.status !== "edit" &&
				activeElement?.status !== "changed" &&
				activeElement?.status !== "new" && (
				<Button type="primary" onClick={handleSwitchToEditMode}>
					{langtext("general.edit_start")}
				</Button>
			)}
		</Fragment>
	);
};

export default observer(ElementPropertiesDetails);