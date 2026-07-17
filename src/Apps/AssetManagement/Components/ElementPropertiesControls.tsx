/*
# SPDX-License-Identifier: GPL-2.0*/

import { Button, Divider, Tooltip } from "antd";
import React, { Fragment, useEffect, useState } from "react";
import { useLangtext } from "../../../lib/common";
import { rootStore } from "../../../Stores/Root.Store";

interface ElementPropertiesControlsProps {
}

/**
 * An editor for editing the schema assigned to an asset.
 * @param props
 * @returns
 */
export const ElementPropertiesControls: React.FC<ElementPropertiesControlsProps> = () => {
	const langtext = useLangtext();
	const { activeElement, isReadOnly } = rootStore.ui;

	return (
		<Fragment>
			This is the place for the MQTT Status and Actionboard.
		</Fragment>
	);
};



