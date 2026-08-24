import React, { useCallback, useState } from "react";
import { observer } from "mobx-react";
import { Divider, Tooltip } from "antd";
import SchemaEditor from "../../../Components/Schema/SchemaEditor/SchemaEditor.Component";
import { SchemaEditorContextProvider } from "../../../Components/Schema/SchemaEditor/SchemaEditorContext";
import DockpartSchemaSelectionDialog from "../../../Components/Schema/DockpartSchemaSelectionDialog";
import { IAsset } from "../../../Stores/Models/Asset.Model";
import { SchemaChooseOnAddRequest } from "../../../Components/Schema/SchemaEditor/SchemaEditorContext";
import { rootStore } from "../../../Stores/Root.Store";
import { useLangtext } from "../../../lib/common";
import { buildElementStatusClass } from "../../../lib/elementStatusStyle";
import { hasElementDocksValidationErrors } from "../../../lib/elementValidationChecks";

interface AssetDocksSectionProps {
	asset: IAsset;
	canEdit: boolean;
}

const AssetDocksSection: React.FC<AssetDocksSectionProps> = ({ asset, canEdit }) => {
	const langtext = useLangtext();
	const [dockpartChooseRequest, setDockpartChooseRequest] =
		useState<SchemaChooseOnAddRequest | null>(null);
	const hasErrors = canEdit && hasElementDocksValidationErrors(rootStore, asset);
	const bodyClass = buildElementStatusClass(
		"element-properties-section__body",
		hasErrors ? "invalid" : undefined
	);

	const requestChooseOnAdd = useCallback((request: SchemaChooseOnAddRequest) => {
		if (request.path === "docks" || request.group.dataStructure.itemName === "docks") {
			asset.addDock(request.group.items);
			return;
		}
		if (request.path.match(/^docks\[\d+\]\.dockparts$/)) {
			setDockpartChooseRequest(request);
			return;
		}
		request.onCancel();
	}, [asset]);

	const handleDockpartSelect = (schemaIds: string[]) => {
		if (!dockpartChooseRequest || schemaIds.length === 0) {
			return;
		}
		const match = dockpartChooseRequest.path.match(/^docks\[(\d+)\]\.dockparts$/);
		if (match) {
			const dockIndex = parseInt(match[1], 10);
			for (const schemaId of schemaIds) {
				asset.addDockpart(dockIndex, schemaId);
			}
		} else {
			dockpartChooseRequest.onCancel();
		}
		setDockpartChooseRequest(null);
	};

	return (
		<section className="element-properties-section">
			<Tooltip title={langtext("general.connection_points")}>
				<Divider>{langtext("general.connection_points")}</Divider>
			</Tooltip>
			<div className={bodyClass}>
				<SchemaEditorContextProvider
					value={{
						schemaName: "COMPONENT-DOCKS",
						dataEntryPath: "",
						requestChooseOnAdd,
					}}
				>
					<SchemaEditor
						schemaName="COMPONENT-DOCKS"
						pathPrefix=""
						elementData={asset}
						canEdit={canEdit}
					/>
				</SchemaEditorContextProvider>
			</div>
			<DockpartSchemaSelectionDialog
				visible={dockpartChooseRequest != null}
				onCancel={() => {
					dockpartChooseRequest?.onCancel();
					setDockpartChooseRequest(null);
				}}
				onSelect={handleDockpartSelect}
			/>
		</section>
	);
};

export default observer(AssetDocksSection);
