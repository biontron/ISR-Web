/*
# SPDX-License-Identifier: GPL-2.0*/
import { Button, Layout, Tabs, theme } from "antd";
import Sider from "antd/es/layout/Sider";
import { Header } from "antd/es/layout/layout";
import { observer } from "mobx-react";
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { rootStore } from "../../Stores/Root.Store";
import {
	ElementGraphOverview,
	ElementGraphSwimlanes,
	ElementGraphMap,
} from "./Components/ElementGraph.Component";
import ElementPropertiesDetails from "./Components/ElementPropertiesDetails";
import { ElementPropertiesConnections } from "./Components/ElementPropertiesConnections";
import { ElementPropertiesControls } from "./Components/ElementPropertiesControls";
import { BreadCrumbs } from "./Components/BreadCrumbs";
import { ElementTree } from "./Components/ElementTree.Component";
import "../../Styles/AssetManagement.css";
import { useLangtext } from "../../lib/common";
import { buildElementStatusClass } from "../../lib/elementStatusStyle";
import { FullscreenOutlined, FullscreenExitOutlined } from "@ant-design/icons";

const { TabPane } = Tabs;

// ====================== ZENTRALE PRESETS ======================
const PRESETS = {
	default: { left: 24, center: 36, right: 40 },
	hirarchy: { left: 48, center: 26, right: 26 }, // Treeview / Orga
	properties: { left: 18, center: 58, right: 24 }, // Settings / Details
	relationship:   { left: 12, center: 12, right: 76 }, // Graph Visualization
} as const;

type PresetMode = keyof typeof PRESETS;

const AssetManagement = observer(() => {
	const { activeView, activeElement, isReadOnly } = rootStore.ui;
	const langtext = useLangtext();
	const params = useParams<{ view?: string; element?: string }>();

	// ====================== STATE ======================
	const [sizes, setSizes] = useState<{ left: number; center: number; right: number }>(PRESETS.default);
	const [graphFullscreen, setGraphFullscreen] = useState(false);
	const [activeGraphTab, setActiveGraphTab] = useState("GraphStack");
	const groupsLoading = rootStore.groups.loading;
	const assetsLoading = rootStore.assets.loading;

	// ====================== DEEP LINK ======================
	useEffect(() => {
		if (params.view) {
			rootStore.ui.setActiveView(params.view as any);
		}
	}, [params.view]);

	useEffect(() => {
		if (groupsLoading || assetsLoading) {
			return;
		}

		const targetId = params.element ?? params.view;
		if (!targetId) {
			return;
		}

		if (rootStore.ui.activeElement?.id === targetId) {
			return;
		}

		rootStore.ui.setActiveElementById(targetId);
	}, [params.view, params.element, groupsLoading, assetsLoading]);

	// ====================== KEYBOARD SHORTCUTS ======================
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

			switch (e.key.toUpperCase()) {
				case "D": applyPreset("default"); break;
				case "H": applyPreset("hirarchy"); break;
				case "P": applyPreset("properties"); break;
				case "R": applyPreset("relationship"); break;
				case "F": setGraphFullscreen(true); break;
				case "ESCAPE": setGraphFullscreen(false); break;
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	// ====================== HELPER ======================
	const getSizes = () => graphFullscreen
		? { left: 0, center: 0, right: 100 }
		: sizes;

	const applyPreset = (mode: PresetMode) => {
		setGraphFullscreen(false);
		setSizes(PRESETS[mode]);
	};

	const propertiesFrameClass = buildElementStatusClass(
		"element-properties-frame",
		!isReadOnly && activeElement ? activeElement.status : undefined
	);

	return (
		<Layout style={{ height: "100%" }}>
			<Header
				className="asset-management-header"
				style={{
					position: "sticky",
					top: 0,
					zIndex: 1,
					display: "flex",
					alignItems: "center",
					backgroundColor: activeView?.properties?.style?.bgColor || "#001529"
				}}
			>
				<div className="demo-logo" />
				<BreadCrumbs />

				{/* ==================== TOOLBAR PRESET BUTTONS ==================== */}
				<div style={{ display: "flex", gap: "6px", marginLeft: "auto", marginRight: "16px", alignItems: "center" }}>

					{/* Normal / Default */}
					<Button
						id="screenmode-preset-default"
						type="primary"
						size="small"
						onClick={() => applyPreset("default")}
						className="preset-btn"
						title={langtext("general.screenmode_default")}
						style={{ width: "5rem" }}
					>Default</Button>

					{/* S - Hirachy /Treeview */}
					<Button
						id="screenmode-preset-hirarchy"
						type="primary"
						size="small"
						onClick={() => applyPreset("hirarchy")}
						className="preset-btn"
						title={langtext("general.screenmode_hirarchy")}
					>H</Button>

					{/* D - Details */}
					<Button
						id="screenmode-preset-properties"
						type="primary"
						size="small"
						onClick={() => applyPreset("properties")}
						className="preset-btn"
						title={langtext("general.screenmode_properties")}
					>P</Button>

					{/* V - Visualisierung */}
					<Button
						id="screenmode-preset-relationship"
						type="primary"
						size="small"
						onClick={() => applyPreset("relationship")}
						className="preset-btn"
						title={langtext("general.screenmode_relationship")}
					>R</Button>

					{/* Fullscreen */}
					<Button
						id="screenmode-fullscreen"
						type="primary"
						size="small"
						className="preset-btn"
						icon={<FullscreenOutlined />}
						onClick={() => setGraphFullscreen(true)}
						style={{ marginLeft: 8, width: "7rem" }}
					>
						{langtext("general.screenmode_fullscreen")}
					</Button>
				</div>
			</Header>

			<Layout className="asset-management-content" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
				{/* LEFT - TREE / Hirachy */}
				<Sider width={`${getSizes().left}%`} style={{ overflow: "auto" }} className="leftArea">
					<div className="area-header" onClick={() => applyPreset("hirarchy")}>
						<span>{langtext("general.screenmode_hirarchy_title")}</span>
					</div>
					<ElementTree />
				</Sider>

				{/* CENTER - PROPERTIES / Eigenschaften */}
				<Layout className={`centerArea ${propertiesFrameClass} ${activeElement?.class}`} style={{ width: `${getSizes().center}%` }}>
					<div className="area-header" onClick={() => applyPreset("properties")}>
						<span>{langtext("general.screenmode_properties_title")}</span>
					</div>
					<Tabs defaultActiveKey="1">
						<TabPane tab={langtext("general.details_tab_details")} key="1">
							{activeElement && <ElementPropertiesDetails />}
						</TabPane>
						{activeElement?.class === "Asset" && (
							<TabPane tab={langtext("general.details_tab_connections")} key="2">
								{activeElement && <ElementPropertiesConnections />}
							</TabPane>
						)}
						{activeElement?.class === "Asset" && (
							<TabPane tab={langtext("general.details_tab_actionboard")} key="3">
								{activeElement && <ElementPropertiesControls />}
							</TabPane>
						)}
					</Tabs>
				</Layout>

				{/* RIGHT - GRAPH */}
				<Sider width={`${getSizes().right}%`} style={{ overflow: "hidden" }} className="rightArea">
					<div className="area-header" onClick={() => applyPreset("relationship")}>
						<span>{langtext("general.screenmode_relationship_title")}</span>
					</div>

					<Tabs defaultActiveKey={activeGraphTab} onChange={setActiveGraphTab}>
						<TabPane tab={langtext("general.graph_tab_overview")} key="GraphStack" />
						<TabPane tab={langtext("general.graph_tab_swimlanes")} key="GraphSwimlanes" />
						<TabPane tab={langtext("general.graph_tab_map")} key="GraphMap" />
					</Tabs>

					<div className="graph-panel-content">
						{activeGraphTab === "GraphStack" && <ElementGraphOverview element={activeElement} />}
						{activeGraphTab === "GraphSwimlanes" && <ElementGraphSwimlanes element={activeElement} />}
						{activeGraphTab === "GraphMap" && <ElementGraphMap element={activeElement} />}
					</div>
				</Sider>
			</Layout>

			{/* ==================== FULLSCREEN ==================== */}
			{graphFullscreen && (
				<div className="graph-fullscreen-overlay">
					<div className="graph-fullscreen-tabs-bar">
						<Tabs
							defaultActiveKey={activeGraphTab}
							onChange={setActiveGraphTab}
							style={{ flex: 1 }}
						>
							<TabPane tab={langtext("general.graph_tab_overview")} key="GraphStack" />
							<TabPane tab={langtext("general.graph_tab_swimlanes")} key="GraphSwimlanes" />
							<TabPane tab={langtext("general.graph_tab_map")} key="GraphMap" />
						</Tabs>

						<Button
							onClick={() => setGraphFullscreen(false)}
							icon={<FullscreenExitOutlined />}
							style={{ marginLeft: "auto" }}
						>
                            Beenden
						</Button>
					</div>

					<div className="graph-fullscreen-content">
						{activeGraphTab === "GraphStack" && <ElementGraphOverview element={activeElement} />}
						{activeGraphTab === "GraphSwimlanes" && <ElementGraphSwimlanes element={activeElement} />}
						{activeGraphTab === "GraphMap" && <ElementGraphMap element={activeElement} />}
					</div>
				</div>
			)}
		</Layout>
	);
});

export default AssetManagement;