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
import { IGroup } from "../../../Stores/Models/Group.Model";
import CardCollapse from "./CardCollapse.Component";
import ConnectionMapping from "../../../Components/Schema/SchemaEditor/Mappings/ConnectionMapping.Component";
import AssetDocksSection from "./AssetDocksSection";
import { useLangtext } from "../../../lib/common";

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

		if (activeElement.class === "Group") {
			const group = activeElement as IGroup;
			return (
				<div style={{ padding: "16px 24px" }}>
					<CardCollapse title={langtext("general.connection_overview")}>
						<ConnectionMapping element={group} />
					</CardCollapse>
				</div>
			);
		}

		const asset = activeElement as IAsset;
		const contextPrefill = rootStore.ui.pendingContextBindContextId
			? {
					contextId: rootStore.ui.pendingContextBindContextId,
					dockpartId: rootStore.ui.pendingContextBindDockpartId || undefined,
				}
			: undefined;

		return (
			<Fragment>
				<div style={{ padding: "16px 24px" }}>
					<AssetDocksSection asset={asset} canEdit={canEdit} />

					<CardCollapse title={langtext("general.connection_overview")}>
						<ConnectionMapping element={asset} contextPrefill={contextPrefill} />
					</CardCollapse>
				</div>
			</Fragment>
		);
	}
);
