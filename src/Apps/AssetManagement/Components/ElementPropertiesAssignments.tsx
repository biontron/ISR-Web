/*
# SPDX-License-Identifier: GPL-2.0*/
import { Divider, Tooltip } from "antd";
import React, { Fragment } from "react";
import SchemaEditor from "../../../Components/Schema/SchemaEditor";
import { useLangtext } from "../../../lib/common";
import { rootStore } from "../../../Stores/Root.Store";
import { observer } from "mobx-react";
import { ASSIGNMENTS_HOST_SCHEMA } from "../../../lib/schemaEditorHostSchemas";

const ElementPropertiesAssignments: React.FC = () => {
	const langtext = useLangtext();
	const { activeElement } = rootStore.ui;
	const canEdit = rootStore.ui.canEditActiveElement();

	if (!activeElement) {
		return null;
	}

	return (
		<Fragment>
			<div className="element-properties-tab">
				<Tooltip title={langtext("general.element_links")}>
					<Divider>{langtext("general.element_links")}</Divider>
				</Tooltip>
				<SchemaEditor
					schema={ASSIGNMENTS_HOST_SCHEMA}
					pathPrefix=""
					data={activeElement}
					canEdit={canEdit}
				/>
			</div>
		</Fragment>
	);
};

export default observer(ElementPropertiesAssignments);
