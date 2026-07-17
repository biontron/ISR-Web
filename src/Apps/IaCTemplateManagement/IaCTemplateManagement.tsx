/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import React, { useCallback, useEffect, useState } from "react";
import { Button, Layout } from "antd";
import Sider from "antd/es/layout/Sider";
import { observer } from "mobx-react";
import { rootStore } from "../../Stores/Root.Store";
import authStore from "../../Stores/Auth.Store";
import TemplateStore from "./Components/TemplateStore";
import TemplateEditor from "./Components/TemplateEditor";
import TemplateRun from "./Components/TemplateRun";
import "../../Styles/AssetManagement.css";
import "./IaCTemplateManagement.css";

const PRESETS = {
	default: { left: 24, center: 46, right: 30 },
	store: { left: 48, center: 26, right: 26 },
	editor: { left: 18, center: 58, right: 24 },
	run: { left: 12, center: 12, right: 76 },
} as const;

type PresetMode = keyof typeof PRESETS;

type PanelSizes = { left: number; center: number; right: number };

const IaCTemplateManagement: React.FC = observer(() => {
	const [sizes, setSizes] = useState<PanelSizes>(PRESETS.default);

	const applyPreset = useCallback((mode: PresetMode) => {
		setSizes(PRESETS[mode]);
	}, []);

	useEffect(() => {
		const domain = authStore.getDomain();
		if (domain && rootStore.iac.packages.length === 0) {
			void rootStore.iac.loadPackages(domain);
		}
	}, []);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
				return;
			}
			switch (event.key.toUpperCase()) {
				case "D":
					applyPreset("default");
					break;
				case "S":
					applyPreset("store");
					break;
				case "E":
					applyPreset("editor");
					break;
				case "R":
					applyPreset("run");
					break;
				default:
					break;
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [applyPreset]);

	return (
		<Layout style={{ height: "100%" }}>
			<div className="iac-template-management-header">
				<span style={{ marginRight: 16, fontWeight: 600 }}>IaC Template Manager</span>
				<Button
					id="screenmode-preset-default"
					size="small"
					className="preset-btn"
					onClick={() => applyPreset("default")}
					title="Default (D)"
					style={{ width: "5rem" }}
				>
					Default
				</Button>
				<Button
					id="screenmode-preset-store"
					size="small"
					className="preset-btn"
					onClick={() => applyPreset("store")}
					title="TemplateStore (S)"
				>
					S
				</Button>
				<Button
					id="screenmode-preset-editor"
					size="small"
					className="preset-btn"
					onClick={() => applyPreset("editor")}
					title="TemplateEditor (E)"
				>
					E
				</Button>
				<Button
					id="screenmode-preset-run"
					size="small"
					className="preset-btn"
					onClick={() => applyPreset("run")}
					title="TemplateRun (R)"
				>
					R
				</Button>
			</div>
			<Layout className="iac-template-management-content">
				<Sider width={`${sizes.left}%`} className="leftArea" style={{ overflow: "hidden" }}>
					<div className="area-header" onClick={() => applyPreset("store")}>
						<span>TemplateStore</span>
					</div>
					<div className="panel-body">
						<TemplateStore />
					</div>
				</Sider>
				<Layout className="centerArea" style={{ width: `${sizes.center}%`, overflow: "hidden" }}>
					<div className="area-header" onClick={() => applyPreset("editor")}>
						<span>TemplateEditor</span>
					</div>
					<div className="panel-body">
						<TemplateEditor />
					</div>
				</Layout>
				<Sider width={`${sizes.right}%`} className="rightArea" style={{ overflow: "hidden" }}>
					<div className="area-header" onClick={() => applyPreset("run")}>
						<span>TemplateRun</span>
					</div>
					<div className="panel-body">
						<TemplateRun />
					</div>
				</Sider>
			</Layout>
		</Layout>
	);
});

export default IaCTemplateManagement;
