import React, { useMemo } from "react";
import { Alert, Button, Typography } from "antd";
import { observer } from "mobx-react";
import { rootStore } from "../../../Stores/Root.Store";
import CopyToClipboardButton from "../../../Components/ChangeMode/CopyToClipboardButton";

const TemplateRun: React.FC = observer(() => {
	const {
		selectedPackageName,
		selectedTemplateName,
		selectedTemplateVersion,
		templateRunState,
		templateRunResult,
		templateRunError,
	} = rootStore.iac;

	const versionLabel = selectedTemplateVersion ? ` · v${selectedTemplateVersion}` : " · Latest";

	// XML Parsing - immer ausführen (auch bei leerem Result)
	const parsed = useMemo(() => {
		if (!templateRunResult?.trim()) {
			return { anzahlAssets: 0, outputContent: "" };
		}

		try {
			const parser = new DOMParser();
			const xmlDoc = parser.parseFromString(templateRunResult, "text/xml");

			const anzahlElement = xmlDoc.querySelector("anzahl-assets");
			const anzahlAssets = anzahlElement ? parseInt(anzahlElement.textContent || "0", 10) : 0;

			const outputElement = xmlDoc.querySelector("output");
			const outputContent = outputElement ? (outputElement.textContent?.trim() ?? "") : templateRunResult;

			return { anzahlAssets, outputContent };
		} catch (err) {
			console.error("XML Parse Error:", err);
			return { anzahlAssets: 0, outputContent: templateRunResult };
		}
	}, [templateRunResult]);

	// Early Return nach allen Hooks
	if (!selectedTemplateName || !selectedPackageName) {
		return <p style={{ padding: 12 }}>Bitte ein Template auswählen.</p>;
	}

	return (
		<div style={{ padding: 12, display: "flex", flexDirection: "column", height: "100%" }}>
			<Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
				Führt <code>?run=now</code> auf dem Server aus ({selectedTemplateName}
				{versionLabel}). Verwendet den gespeicherten Template-Stand.
			</Typography.Paragraph>

			{/* Toolbar */}
			<div className="iac-template-run-toolbar" style={{ marginBottom: 16 }}>
				<Button
					type="primary"
					loading={templateRunState === "loading"}
					onClick={() => void rootStore.iac.runTemplate()}
				>
					Ausführen
				</Button>
				<CopyToClipboardButton
					text={parsed.outputContent}
					disabled={!parsed.outputContent}
				/>
			</div>

			{/* Fehler */}
			{templateRunState === "error" && templateRunError && (
				<Alert
					type="error"
					showIcon
					message="Run fehlgeschlagen"
					description={templateRunError}
					style={{ marginBottom: 12 }}
				/>
			)}

			{/* Ergebnis */}
			{templateRunResult && templateRunResult.trim() !== "" ? (
				<>
					{/* Anzahl Assets */}
					<div style={{
						padding: "16px",
						background: "#f0f5ff",
						border: "1px solid #91caff",
						borderRadius: "8px",
						marginBottom: "16px",
						display: "flex",
						alignItems: "center",
						gap: "16px"
					}}>
						<span style={{ fontSize: "32px" }}>📊</span>
						<div>
							<div style={{ fontSize: "14px", color: "#1890ff" }}>Anzahl Assets</div>
							<div style={{ fontSize: "36px", fontWeight: "bold", color: "#1890ff" }}>
								{parsed.anzahlAssets}
							</div>
						</div>
					</div>

					{/* Output */}
					<div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
						<div style={{ marginBottom: "8px", fontWeight: 500 }}>Template Output:</div>
						<pre style={{
							flex: 1,
							overflow: "auto",
							whiteSpace: "pre-wrap",
							fontSize: 13,
							padding: 14,
							background: "#1f2937",
							color: "#e5e7eb",
							borderRadius: "6px",
							border: "1px solid #374151",
							lineHeight: "1.5"
						}}>
							{parsed.outputContent || "Keine Ausgabe"}
						</pre>
					</div>
				</>
			) : templateRunState === "loaded" ? (
				<Typography.Text type="secondary">Leere Antwort.</Typography.Text>
			) : null}
		</div>
	);
});

export default TemplateRun;