/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { ReactNode, useEffect } from "react";
import { observer } from "mobx-react";
import { useLocation, useNavigate } from "react-router";
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
	const location = useLocation();

	useEffect(() => {
		const lang = new URLSearchParams(location.search).get("lang");
		if (
			lang &&
			rootStore.i18n.availableLanguages.includes(lang) &&
			lang !== rootStore.i18n.lang
		) {
			rootStore.i18n.setLanguage(lang);
		}
	}, [location.search]);

	function handleLanguageChange(e: React.ChangeEvent<HTMLSelectElement>) {
		const selectedLang = e.target.value;
		rootStore.i18n.setLanguage(selectedLang);
		const nextSearch = new URLSearchParams(location.search);
		nextSearch.set("lang", selectedLang);
		navigate(
			{ pathname: location.pathname, search: nextSearch.toString() },
			{ replace: true }
		);
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