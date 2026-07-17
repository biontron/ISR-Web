/*
# SPDX-License-Identifier: GPL-2.0*/

import React from "react";
import Paragraph from "antd/lib/typography/Paragraph";
import { ExtraDataEntry, formatExtraValue } from "../../../lib/schemaDeviation";

interface SchemaEditorExtraDataProps {
	entries: ExtraDataEntry[];
}

const SchemaEditorExtraData: React.FC<SchemaEditorExtraDataProps> = ({ entries }) => {
	if (entries.length === 0) {
		return null;
	}

	return (
		<div className="schema-editor-extra-data">
			{entries.map((entry) => (
				<div
					key={entry.path}
					className="schema-editor-extra-data-item"
					style={{
						marginTop: 12,
						padding: 8,
						border: "1px dashed #ff4d4f",
						backgroundColor: "#fff2f0",
					}}
				>
					<div style={{ color: "#cf1322", fontWeight: 500, marginBottom: 4 }}>
						Nicht zulässige Datenstruktur
					</div>
					<Paragraph
						className="schema-editor-extra-data-value"
						style={{ marginBottom: 4, whiteSpace: "pre-wrap" }}
					>
						{formatExtraValue(entry.value)}
					</Paragraph>
					<div
						className="schema-editor-extra-data-path"
						style={{ color: "#cf1322", fontFamily: "monospace", fontSize: 12 }}
					>
						{entry.path}
					</div>
				</div>
			))}
		</div>
	);
};

export default SchemaEditorExtraData;
