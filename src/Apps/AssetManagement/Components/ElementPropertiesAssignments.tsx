/*
# SPDX-License-Identifier: GPL-2.0*/
import { Divider, Tooltip } from "antd";
import React, { Fragment } from "react";
import CardCollapse from "./CardCollapse.Component";
import { useLangtext } from "../../../lib/common";
import { rootStore } from "../../../Stores/Root.Store";
import { observer } from "mobx-react";
import AssetReferenceMapping from "../../../Components/Schema/SchemaEditor/Mappings/AssetReferenceMapping.Component";
import ViewValidationRules from "../../../Components/Schema/SchemaEditor/Mappings/ViewValidationRules.Component";
import ViewEnvironmentsMapping from "../../../Components/Schema/SchemaEditor/Mappings/ViewEnvironmentsMapping.Component";
import { IView } from "../../../Stores/Models/View.Model";

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
				{activeElement.class === "View" ? (
					<>
						<CardCollapse title={langtext("general.view_environments")}>
							<ViewEnvironmentsMapping view={activeElement as IView} />
						</CardCollapse>
						<CardCollapse title={langtext("general.view_validation_rules")}>
							<ViewValidationRules view={activeElement as IView} />
						</CardCollapse>
					</>
				) : null}
			</div>
		</Fragment>
	);
};

export default observer(ElementPropertiesAssignments);
