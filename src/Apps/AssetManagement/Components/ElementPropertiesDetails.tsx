/*
# SPDX-License-Identifier: GPL-2.0*/
// File: ./src/Apps/AssetManagement/Components/ElementPropertiesDetailss.tsx

import { Button, Divider, Tooltip } from "antd";
import React, { Fragment } from "react";
import SchemaEditor from "../../../Components/Schema/SchemaEditor";
import { useLangtext } from "../../../lib/common";
import { rootStore } from "../../../Stores/Root.Store";
import { observer } from "mobx-react";
import { isTreeElement } from "../../../Interfaces/Element";
import { buildElementStatusClass } from "../../../lib/elementStatusStyle";
import {
	hasElementSettingsValidationErrors,
	hasElementValidationOrStoreErrors,
} from "../../../lib/elementValidationChecks";
import { resolveElementSettingsSchemaName } from "../../../lib/elementDefinitionTypes";

interface ElementPropertiesDetailsProps {}

const ElementPropertiesDetails: React.FC<ElementPropertiesDetailsProps> = () => {
	const langtext = useLangtext();
	const { activeElement } = rootStore.ui;

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

	const hasFieldErrors =
		!!activeElement && hasElementValidationOrStoreErrors(rootStore, activeElement);

	const handleReset = () => {
		if (activeElement) {
			activeElement.rollbackEdit();
		}
	};

	return (
		<Fragment>
			<div className="element-properties-tab">
			{/* Status-spezifische Buttons */}
			{(activeElement?.status === "edit" || activeElement?.status === "changed") && (
				<>
					<Button type="primary" danger={hasFieldErrors} onClick={handleStore}>
						{langtext("general.edit_store")}
					</Button>
					<Button onClick={handleReset}>{langtext("general.edit_reset")}</Button>
				</>
			)}

			{isAssetLike && activeElement && (
				<section className="element-properties-section">
					<Tooltip title={langtext("general.element_properties")}>
						<Divider>{langtext("general.element_properties")}</Divider>
					</Tooltip>
					<SchemaEditor
						schemaName="ANY-PROPERTIES"
						pathPrefix="properties"
						data={activeElement}
						canEdit={canEdit}
					/>
				</section>
			)}

			{isAssetLike && isTreeElement(activeElement) && (
				<section className="element-properties-section">
					<Tooltip title={langtext("general.element_settings")}>
						<Divider>{langtext("general.element_settings")}</Divider>
					</Tooltip>
					<div className={settingsBodyClass}>
						<SchemaEditor
							schema={rootStore.configSchemas.findSchemaForDefinition(
								activeElement.definition
							)}
							schemaName={resolveElementSettingsSchemaName(
								activeElement.definition,
								rootStore.configSchemas.schemaCompat
							)}
							pathPrefix="settings"
							data={activeElement}
							canEdit={canEdit}
						/>
					</div>
				</section>
			)}

			{activeElement && (
				<section className="element-properties-section element-properties-section--definition">
					<Tooltip title={langtext("general.element_definition")}>
						<Divider>{langtext("general.element_definition")}</Divider>
					</Tooltip>
					<SchemaEditor
						schemaName="ANY-DEFINITION"
						pathPrefix=""
						data={activeElement}
						canEdit={canEdit}
					/>
				</section>
			)}

			</div>
		</Fragment>
	);
};

export default observer(ElementPropertiesDetails);