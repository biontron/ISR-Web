/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { ReactNode, useEffect, useState } from "react";
import { observer } from "mobx-react";
import { getSnapshot } from "mobx-state-tree";
import { useLocation, useNavigate } from "react-router";
import { Menu, Dropdown } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { rootStore } from "../../Stores/Root.Store";
import { Link } from "react-router-dom";
import authStore from "../../Stores/Auth.Store";
import { useLangtext } from "../../lib/common";
import ChangeModeToolbar from "../ChangeMode/ChangeModeToolbar";
import ActivityStatusOverviewModal from "../ChangeMode/ActivityStatusOverviewModal";
import ElementSearchField from "../Search/ElementSearchField";
import ElementSearchHitsDialog from "../Search/ElementSearchHitsDialog";
import { environmentDisplayName } from "../../Stores/Models/Environment.Model";
import { readViewEnvironmentBindings, slugViewCollectionId } from "../../lib/viewEnvironments";
import {
	buildElementJsonInspectTarget,
	buildSnapshotJsonInspectTarget,
} from "../../lib/jsonInspectResolve";
import CatalogAdminDialog from "./CatalogAdminDialog";
import UserSettingsDialog from "./UserSettingsDialog";

interface CommonLayoutProps {
	children: ReactNode;
}

function downloadJson(filename: string, payload: unknown) {
	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

const CommonLayout: React.FC<CommonLayoutProps> = observer(({ children }) => {
	const langtext = useLangtext();
	const navigate = useNavigate();
	const location = useLocation();
	const [catalogKind, setCatalogKind] = useState<"view" | "environment" | null>(null);
	const [userSettingsOpen, setUserSettingsOpen] = useState(false);

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

	useEffect(() => {
		if (authStore.isAuthenticated && authStore.username) {
			void rootStore.userSettings.load();
		}
	}, [authStore.isAuthenticated, authStore.username]);

	useEffect(() => {
		const focusSearch = (event: KeyboardEvent) => {
			if (!(event.ctrlKey || event.metaKey)) {
				return;
			}
			const key = event.key.toLowerCase();
			if (key !== "f" && key !== "s") {
				return;
			}
			event.preventDefault();
			const input = document.querySelector<HTMLInputElement>(
				"#isr-element-search, .element-search-field input"
			);
			input?.focus();
			input?.select();
			if (rootStore.ui.elementSearchText.trim()) {
				rootStore.ui.setElementSearchDialogOpen(true);
			}
		};
		window.addEventListener("keydown", focusSearch);
		return () => window.removeEventListener("keydown", focusSearch);
	}, []);

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
			<Menu.Item key="settings" onClick={() => setUserSettingsOpen(true)}>
				{langtext("general.user_settings")}
			</Menu.Item>
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

	const downloadOs = /Win/i.test(navigator.userAgent)
		? "windows"
		: /Mac/i.test(navigator.userAgent)
			? "macos"
			: "linux";

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

	const adminMenu = (
		<Menu>
			<Menu.ItemGroup title={langtext("general.menu_manage")}>
				<Menu.Item key="views-manage" onClick={() => setCatalogKind("view")}>
					{langtext("general.catalog_manage_views")}
				</Menu.Item>
				<Menu.Item key="envs-manage" onClick={() => setCatalogKind("environment")}>
					{langtext("general.catalog_manage_environments")}
				</Menu.Item>
			</Menu.ItemGroup>
			<Menu.ItemGroup title={langtext("general.menu_download")}>
				<Menu.Item key="schema-management">
					<Link to={"/" + authStore.getDomain() + "/sm"}>
						{langtext("general.menu_schema_management")}
					</Link>
				</Menu.Item>
				<Menu.Item key="dl-schemas">
					<a href="/app/download/schema-editor-templates.zip" target="_blank" rel="noreferrer">
						{langtext("general.menu_download_schemas")}
					</a>
				</Menu.Item>
			</Menu.ItemGroup>
			<Menu.ItemGroup title={langtext("general.menu_tools")}>
				<Menu.Item key="dl-app">
					<a href="/app/download/index.html" target="_blank" rel="noreferrer">
						{langtext("general.menu_download_app")}
					</a>
				</Menu.Item>
				<Menu.Item key="dl-observer">
					<a href={`/app/download/network-observer-service-${downloadOs}`} target="_blank" rel="noreferrer">
						{langtext("general.menu_download_observer")}
					</a>
				</Menu.Item>
				<Menu.Item key="dl-invoker">
					<a href={`/app/download/service-invoker-service-${downloadOs}`} target="_blank" rel="noreferrer">
						{langtext("general.menu_download_invoker")}
					</a>
				</Menu.Item>
			</Menu.ItemGroup>
		</Menu>
	);

	const canEdit = !rootStore.ui.isReadOnly;

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
					<Dropdown overlay={adminMenu}>
						<a
							className="ant-dropdown-link"
							onClick={(e) => e.preventDefault()}
						>
							{langtext("general.admin_menu")} <DownOutlined />
						</a>
					</Dropdown>

					<ChangeModeToolbar />
				</div>

				<div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
					<ElementSearchField />
					<select
						className="common-layout-lang"
						value={rootStore.i18n.lang}
						onChange={handleLanguageChange}
					>
						<option value="de">de</option>
						<option value="en">en</option>
					</select>
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
			<UserSettingsDialog open={userSettingsOpen} onClose={() => setUserSettingsOpen(false)} />
			<ActivityStatusOverviewModal />
			<ElementSearchHitsDialog />
			<CatalogAdminDialog
				open={catalogKind === "view"}
				kind="view"
				title={langtext("general.catalog_views_title")}
				canEdit={canEdit}
				initialId={rootStore.ui.activeView?.id}
				idFromName={slugViewCollectionId}
				items={rootStore.views.views.map((view) => ({
					id: view.id,
					name: view.definition.name || view.id,
				}))}
				onClose={() => setCatalogKind(null)}
				onCreate={async (name) => {
					const created = await rootStore.views.createNamed(name);
					if (created) {
						navigate(`/${authStore.getDomain()}/am/${created.id}`);
					}
				}}
				onRename={async (id, name) => {
					const view = rootStore.views.findById(id);
					if (!view) {
						return;
					}
					view.setDefinitionName(name);
					await rootStore.views.store(id);
				}}
				onDelete={async (id) => {
					await rootStore.views.remove(id);
					if (rootStore.ui.activeView?.id === id) {
						navigate(`/${authStore.getDomain()}/am`);
					}
				}}
				onExport={(id) => {
					const view = rootStore.views.findById(id);
					if (!view) {
						return;
					}
					downloadJson(`${view.id}.json`, getSnapshot(view));
				}}
				resolveInspect={(id) => {
					const view = rootStore.views.findById(id);
					return view ? buildElementJsonInspectTarget(view) : null;
				}}
			/>
			<CatalogAdminDialog
				open={catalogKind === "environment"}
				kind="environment"
				title={langtext("general.catalog_environments_title")}
				canEdit={canEdit}
				initialId={rootStore.ui.activeView?.environments?.[0]?.ref}
				items={rootStore.environments.environments.map((environment) => ({
					id: environment.id,
					name: environmentDisplayName(environment),
				}))}
				onClose={() => setCatalogKind(null)}
				onCreate={async (name) => {
					const created = await rootStore.environments.create(name);
					const view = rootStore.ui.activeView;
					if (!created || !view) {
						return;
					}
					const bindings = readViewEnvironmentBindings(view);
					view.setEnvironments([
						...bindings,
						{ ref: created.id, primary: bindings.length === 0 },
					]);
					await rootStore.views.store(view.id);
				}}
				onRename={async (id, name) => {
					await rootStore.environments.rename(id, name);
				}}
				onDelete={async (id) => {
					await rootStore.environments.remove(id);
				}}
				onExport={(id) => {
					const environment = rootStore.environments.findById(id);
					if (!environment) {
						return;
					}
					downloadJson(`${environment.id}.json`, getSnapshot(environment));
				}}
				resolveInspect={(id) => {
					const environment = rootStore.environments.findById(id);
					if (!environment) {
						return null;
					}
					return buildSnapshotJsonInspectTarget(
						"Environment",
						environmentDisplayName(environment),
						getSnapshot(environment)
					);
				}}
			/>
		</div>
	);
});

export default CommonLayout;
