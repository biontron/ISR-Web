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

		if (!activeElement || activeElement.class !== "Asset") {
			return (
				<div style={{ padding: 24 }}>
					<Empty description="..." />
				</div>
			);
		}

		const asset = activeElement as IAsset;

		return (
			<Fragment>
				<div style={{ padding: "16px 24px" }}>
					<AssetDocksSection asset={asset} canEdit={canEdit} />

					<CardCollapse title={langtext("general.connection_overview")}>
						<ConnectionMapping element={asset} />
					</CardCollapse>
				</div>
			</Fragment>
		);
	}
);
