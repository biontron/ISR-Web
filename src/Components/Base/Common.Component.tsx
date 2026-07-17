/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { ReactNode } from "react";
import { observer } from "mobx-react";
import { useNavigate } from "react-router";
import { Menu, Dropdown } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { rootStore } from "../../Stores/Root.Store";
import { Link } from "react-router-dom";
import authStore from "../../Stores/Auth.Store";
import { useLangtext } from "../../lib/common";
import ChangeModeToolbar from "../ChangeMode/ChangeModeToolbar";
import ActivityStatusOverviewModal from "../ChangeMode/ActivityStatusOverviewModal";

interface CommonLayoutProps {
	children: ReactNode;
}

const CommonLayout: React.FC<CommonLayoutProps> = observer(({ children }) => {
	const langtext = useLangtext();
	const navigate = useNavigate();

	function handleLanguageChange(e: React.ChangeEvent<HTMLSelectElement>) {
		const selectedLang = e.target.value;
		const basePath = `${authStore.getDomain()}/am?lang=${selectedLang}`;
		const { activeView, activeElement } = rootStore.ui;

		switch (activeElement?.class) {
			case "View":
				navigate(`${basePath}/${activeView?.id}`);
				break;
			case "Group":
			case "Asset":
				navigate(
					`${basePath}/${activeView?.id}/element/${activeElement?.id}`
				);
				break;
			default:
				navigate(`${basePath}`);
		}
	}

	const handleClearStoredData = () => {
		authStore.setShouldRemember(false);
		navigate("/logout");
	};

	const userMenu = (
		<Menu>
			<Menu.Item key="1">
				<Link to="/logout">
					{langtext("general.account_logout")}
				</Link>
			</Menu.Item>
			<Menu.Divider/>
			<Menu.Item key="2" onClick={handleClearStoredData}>
				{langtext("general.account_clear_stored")}
			</Menu.Item>
		</Menu>
	);

	const appMenu = (
		<Menu>
			<Menu.Item key="1">
				<Link to={"/" + authStore.getDomain() + "/am"}>
					Asset Management (AM)
				</Link>
			</Menu.Item>
			<Menu.Item key="2">
				<Link to={"/" + authStore.getDomain() + "/sm"}>
					Schema Management (SM)
				</Link>
			</Menu.Item>
			<Menu.Item key="3">
				<Link to={"/" + authStore.getDomain() + "/im"}>
					IaC Config-Files
				</Link>
			</Menu.Item>
		</Menu>
	);

	return (
		<div className="common-layout">
			<nav className="common-layout-nav">
				<div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
					<Dropdown overlay={appMenu}>
						<a
							className="ant-dropdown-link"
							onClick={(e) => e.preventDefault()}
						>
							{langtext("general.main_menu")} <DownOutlined />
						</a>
					</Dropdown>

					<ChangeModeToolbar />

					<select
						value={rootStore.i18n.lang}
						onChange={handleLanguageChange}
					>
						<option value="de">de</option>
						<option value="en">en</option>
					</select>
				</div>

				<div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
					<Dropdown overlay={userMenu}>
						<a
							className="ant-dropdown-link"
							onClick={(e) => e.preventDefault()}
							style={{ color: "#666" }}
						>
							{authStore.username} <DownOutlined />
						</a>
					</Dropdown>
				</div>
			</nav>
			<main className="common-layout-main">{children}</main>
			<ActivityStatusOverviewModal />
		</div>
	);
});

export default CommonLayout;