/*
# SPDX-License-Identifier: GPL-2.0*/

import React from "react";
import { Button, Layout, Select, Tabs, Tree } from "antd";
import { observer } from "mobx-react";
import { Fragment } from "react";
import { useNavigate } from "react-router";

export const Overview = observer(() => {
	return (
		<Fragment>
			<div style={{ width: "100%", height: "100%" }}>
				<img src="/app/logo.svg" alt="Logo" style={{ width: "100%", height: "100%" }} />
			</div>
		</Fragment>
	);
});