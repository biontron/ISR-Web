/*
# SPDX-License-Identifier: GPL-2.0*/
import { Divider, Tooltip } from "antd";
import React, { Fragment } from "react";
import CardCollapse from "./CardCollapse.Component";
import { useLangtext } from "../../../lib/common";
import { rootStore } from "../../../Stores/Root.Store";
import { observer } from "mobx-react";
import AssetReferenceMapping from "../../../Components/Schema/SchemaEditor/Mappings/AssetReferenceMapping.Component";

const ElementPropertiesAssignments: React.FC = () => {
	const langtext = useLangtext();
	const { activeElement } = rootStore.ui;
	const showAssignments =
		activeElement?.class === "View" ||
		activeElement?.class === "Group" ||
		activeElement?.class === "Asset";

	if (!showAssignments) {
		return null;
	}

	return (
		<Fragment>
			<div style={{ padding: "16px 24px" }}>
				<Tooltip title={langtext("general.element_links")}>
					<Divider>{langtext("general.element_links")}</Divider>
				</Tooltip>
				<CardCollapse title={langtext("general.assetreference_assignment")}>
					<AssetReferenceMapping element={activeElement} />
				</CardCollapse>
			</div>
		</Fragment>
	);
};

export default observer(ElementPropertiesAssignments);
