/*
    ========================================================================
    LICENSE AGREEMENT:
    ...
========================================================================
*/
// File: src/Apps/AssetManagement/Components/ElementPropertiesConnections.tsx

import React, { Fragment } from "react";
import { Empty } from "antd";
import { observer } from "mobx-react";
import { rootStore } from "../../../Stores/Root.Store";
import { IAsset } from "../../../Stores/Models/Asset.Model";
import SchemaEditor from "../../../Components/Schema/SchemaEditor";
import AssetDocksSection from "./AssetDocksSection";
import { useLangtext } from "../../../lib/common";
import { CONNECTIONS_HOST_SCHEMA } from "../../../lib/schemaEditorHostSchemas";

interface ElementPropertiesConnectionsProps {}

export const ElementPropertiesConnections: React.FC<ElementPropertiesConnectionsProps> = observer(
	() => {
		const langtext = useLangtext();
		const { activeElement } = rootStore.ui;
		const canEdit = rootStore.ui.canEditActiveElement();

		if (!activeElement || (activeElement.class !== "Asset" && activeElement.class !== "Group")) {
			return (
				<div style={{ padding: 24 }}>
					<Empty description="..." />
				</div>
			);
		}

		const contextPrefill = rootStore.ui.pendingContextBindContextId
			? {
					contextId: rootStore.ui.pendingContextBindContextId,
					dockpartId: rootStore.ui.pendingContextBindDockpartId || undefined,
				}
			: undefined;

		return (
			<Fragment>
				<div style={{ padding: "16px 24px" }}>
					{activeElement.class === "Asset" ? (
						<AssetDocksSection asset={activeElement as IAsset} canEdit={canEdit} />
					) : null}
					<SchemaEditor
						schema={CONNECTIONS_HOST_SCHEMA}
						pathPrefix=""
						data={activeElement}
						canEdit={canEdit}
						wizardExtras={{ connectionContextPrefill: contextPrefill }}
					/>
				</div>
			</Fragment>
		);
	}
);
