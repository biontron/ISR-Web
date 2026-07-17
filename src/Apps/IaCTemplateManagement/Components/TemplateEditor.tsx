import React, { useRef, useState, useMemo } from "react";
import {
	Alert,
	Button,
	Input,
	Select,
	Space,
	Typography,
	Tabs,
	Form,
	Divider
} from "antd";
import type { TextAreaRef } from "antd/es/input/TextArea";
import { observer } from "mobx-react";

import { rootStore } from "../../../Stores/Root.Store";
import CopyToClipboardButton from "../../../Components/ChangeMode/CopyToClipboardButton";
import { buildElementStatusClass } from "../../../lib/elementStatusStyle";

const { TextArea } = Input;
const { TabPane } = Tabs;

const TEMPLATE_SNIPPETS = [
	{
		label: "Wertausgabe",
		text: "<tp:variable>count(groups/*)</tp:variable>"
	},
	{
		label: "If-Bedingung",
		text: "<tp:if test=\"assets/asset[@name='Workstation']\">\n</tp:if>"
	},
	{
		label: "For-Schleife",
		text: "<tp:for-each select=\"assets/asset\">\n  - <tp:variable>definition/name</tp:variable>\n</tp:for-each>"
	},
	{
		label: "Debug",
		text: "<tp:debug>assets/asset[1]</tp:debug>"
	}
] as const;

const parseIacTemplateXml = (xmlText: string) => {
	console.warn("Using fallback parser");
	const domainMatch = xmlText.match(/<domain>(.*?)<\/domain>/s);
	const envMatch = xmlText.match(/<environment>(.*?)<\/environment>/s);
	const viewMatch = xmlText.match(/<view>(.*?)<\/view>/s);
	const groupMatch = xmlText.match(/<group>(.*?)<\/group>/s);
	const assetMatch = xmlText.match(/<asset>(.*?)<\/asset>/s);
	const texttemplateMatch = xmlText.match(/<texttemplate>([\s\S]*?)<\/texttemplate>/i);

	return {
		id: xmlText.match(/id="([^"]+)"/)?.[1] || "",
		filename: xmlText.match(/filename="([^"]+)"/)?.[1] || "",
		format: xmlText.match(/format="([^"]+)"/)?.[1] || "",
		mimeType: xmlText.match(/mime-type="([^"]+)"/)?.[1] || "",
		version: xmlText.match(/version="([^"]+)"/)?.[1] || "",
		dataset: {
			domain: domainMatch?.[1]?.trim(),
			environment: envMatch?.[1]?.trim(),
			view: viewMatch?.[1]?.trim(),
			group: groupMatch?.[1]?.trim(),
			asset: assetMatch?.[1]?.trim()
		},
		texttemplate: texttemplateMatch ? texttemplateMatch[1].trim() : ""
	};
};

const TemplateEditor: React.FC = observer(() => {
	const { isReadOnly } = rootStore.ui;
	const iac = rootStore.iac;
	const textAreaRef = useRef<TextAreaRef>(null);

	const {
		selectedPackageName,
		selectedTemplateName,
		templateEditXml,
		templateEditDirty,
		templateDetailLoadState,
		templateDetailError,
		templateSaveState,
		templateSaveError,
		templateEditValidationError
	} = iac;

	const [activeTab, setActiveTab] = useState<"form" | "advanced">("form");

	const parsedTemplate = useMemo(() => {
		if (!templateEditXml) return null;
		try {
			return parseIacTemplateXml(templateEditXml);
		} catch (err) {
			console.warn("XML Parsing fehlgeschlagen:", err);
			return null;
		}
	}, [templateEditXml]);

	const currentTextTemplate = parsedTemplate?.texttemplate || "";

	const updateRootAttribute = (attr: string, newValue: string) => {
		if (isReadOnly || !templateEditXml) return;
		let newXml = templateEditXml.replace(new RegExp(`${attr}="[^"]*"`, "i"), `${attr}="${newValue}"`);
		if (newXml === templateEditXml) {
			newXml = templateEditXml.replace(/<iac-template\s/, `<iac-template ${attr}="${newValue}" `);
		}
		rootStore.iac.setTemplateEditXml(newXml);
	};

	const updateDatasetField = (field: string, newValue: string) => {
		if (isReadOnly || !templateEditXml) return;
		let newXml = templateEditXml;

		const regex = new RegExp(`(<${field}>)(.*?)(</${field}>)`, "s");
		if (regex.test(newXml)) {
			newXml = newXml.replace(regex, `$1${newValue}$3`);
		} else {
			newXml = newXml.replace(
				/(<dataset>)([\s\S]*?)(<\/dataset>)/i,
				`$1$2    <${field}>${newValue}</${field}>\n$3`
			);
		}
		rootStore.iac.setTemplateEditXml(newXml);
	};

	const insertSnippetIntoText = (snippet: string) => {
		if (isReadOnly) return;
		const textarea = textAreaRef.current?.resizableTextArea?.textArea;
		if (!textarea) return;

		const current = currentTextTemplate;
		const start = textarea.selectionStart ?? current.length;
		const end = textarea.selectionEnd ?? start;

		const nextText = current.slice(0, start) + snippet + current.slice(end);
		rootStore.iac.updateTextTemplate(nextText);
	};

	if (!selectedTemplateName || !selectedPackageName) {
		return <p style={{ padding: 12 }}>Bitte ein Template im Baum auswählen.</p>;
	}

	if (templateDetailLoadState === "loading") {
		return <p style={{ padding: 12 }}>Template wird geladen…</p>;
	}

	return (
		<div className={buildElementStatusClass("iac-template-editor-panel element-properties-frame", !isReadOnly ? "edit" : undefined)}>
			<div className="iac-template-editor-toolbar">
				<Space direction="vertical" size="small" style={{ flex: 1 }}>
					<Typography.Text strong>{selectedTemplateName}</Typography.Text>
					<Typography.Text type="secondary">
						{parsedTemplate?.filename} • {parsedTemplate?.format?.toUpperCase()}
					</Typography.Text>
				</Space>
				<CopyToClipboardButton text={templateEditXml ?? ""} disabled={!templateEditXml} />
			</div>

			<Space direction="vertical" size="small" style={{ marginBottom: 12, width: "100%" }}>
				{templateDetailLoadState === "error" && templateDetailError && (
					<Alert type="warning" showIcon message="Fehler beim Laden" description={templateDetailError} />
				)}
				{templateEditValidationError && templateEditDirty && !isReadOnly && (
					<Alert type="error" showIcon message="Ungültiges XML" description={templateEditValidationError} />
				)}
			</Space>

			<Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as "form" | "advanced")}>

				<TabPane tab="Template Editor" key="text">
					<Form layout="vertical" disabled={isReadOnly}>
						<Space direction="vertical" size="middle" style={{ width: "100%" }}>
							{/* Text Template */}
							<div>
								<Typography.Title level={5}>Template Inhalt</Typography.Title>

								{!isReadOnly && (
									<Space wrap style={{ marginTop: 12 }}>
										{TEMPLATE_SNIPPETS.map((snippet) => (
											<Button key={snippet.label} size="small" onClick={() => insertSnippetIntoText(snippet.text)}>
												{snippet.label}
											</Button>
										))}
									</Space>
								)}
								<TextArea
									ref={textAreaRef}
									value={currentTextTemplate}
									onChange={(e) => rootStore.iac.updateTextTemplate(e.target.value)}
									autoSize={{ minRows: 18, maxRows: 40 }}
									style={{
										fontFamily: "ui-monospace, monospace",
										fontSize: 13.5,
										background: "#1f2937",
										color: "#e5e7eb",
										border: "1px solid #374151",
										resize: "none"
									}}
								/>
							</div>
						</Space>
					</Form>
				</TabPane>

				<TabPane tab="Metadaten" key="form">
					<Form layout="vertical" disabled={isReadOnly}>
						<Space direction="vertical" size="middle" style={{ width: "100%" }}>
							{/* Metadaten */}
							<div>
								<Typography.Title level={5}>Template Metadaten</Typography.Title>
								<Space direction="vertical" style={{ width: "100%" }}>
									<Form.Item label="ID">
										<Input value={parsedTemplate?.id || ""} disabled />
									</Form.Item>
									<Form.Item label="Filename">
										<Input
											value={parsedTemplate?.filename || ""}
											disabled={isReadOnly}
											onChange={(e) => updateRootAttribute("filename", e.target.value)}
										/>
									</Form.Item>
									<Form.Item label="Format">
										<Select
											value={parsedTemplate?.format || ""}
											disabled={isReadOnly}
											onChange={(v) => updateRootAttribute("format", v)}
											options={[
												{ value: "yaml", label: "YAML" },
												{ value: "json", label: "JSON" }
											]}
										/>
									</Form.Item>
									<Form.Item label="Mime-Type">
										<Input
											value={parsedTemplate?.mimeType || ""}
											disabled={isReadOnly}
											onChange={(e) => updateRootAttribute("mime-type", e.target.value)}
										/>
									</Form.Item>
									<Form.Item label="Version">
										<Input
											value={parsedTemplate?.version || ""}
											disabled={isReadOnly}
											onChange={(e) => updateRootAttribute("version", e.target.value)}
										/>
									</Form.Item>
								</Space>
							</div>

							{/* Dataset */}
							<div>
								<Typography.Title level={5}>Dataset / Kontext</Typography.Title>
								<Space direction="vertical" style={{ width: "100%" }}>
									{["domain", "environment", "view", "group", "asset"].map((field) => (
										<Form.Item key={field} label={field.charAt(0).toUpperCase() + field.slice(1)}>
											<Input
												value={(parsedTemplate?.dataset as any)?.[field] || ""}
												disabled={isReadOnly}
												onChange={(e) => updateDatasetField(field, e.target.value)}
											/>
										</Form.Item>
									))}
								</Space>
							</div>
						</Space>
					</Form>
				</TabPane>

				<TabPane tab="Vollständiges XML" key="advanced">
					<TextArea
						value={templateEditXml ?? ""}
						onChange={(e) => rootStore.iac.setTemplateEditXml(e.target.value)}
						autoSize={{ minRows: 25, maxRows: 50 }}
						style={{ fontFamily: "monospace" }}
					/>
				</TabPane>
			</Tabs>

			<Space style={{ marginTop: 16 }}>
				<Button
					type="primary"
					disabled={isReadOnly || !templateEditDirty}
					loading={templateSaveState === "saving"}
					onClick={() => void rootStore.iac.saveTemplate()}
				>
					Speichern
				</Button>
				<Button
					disabled={isReadOnly || !templateEditDirty}
					onClick={() => rootStore.iac.discardTemplateEdit()}
				>
					Verwerfen
				</Button>
			</Space>
		</div>
	);
});

export default TemplateEditor;