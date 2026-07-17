/*
# SPDX-License-Identifier: GPL-2.0*/

import React from "react";
import { Empty } from "antd";
import { FileExclamationOutlined } from "@ant-design/icons";
import { useLangtext } from "../../../lib/common";

export type SchemaEditorEmptyReason =
	| "no_element"
	| "no_schema"
	| "no_fields"
	| "no_view_settings";

interface SchemaEditorEmptyStateProps {
	reason: SchemaEditorEmptyReason;
	detail?: string;
}

const SchemaEditorEmptyState: React.FC<SchemaEditorEmptyStateProps> = ({
	reason,
	detail,
}) => {
	const langtext = useLangtext();

	if (reason === "no_view_settings") {
		return (
			<div className="schema-editor-empty schema-editor-empty--info">
				<p className="schema-editor-empty__message">
					{langtext("schema_editor.no_object_settings_view")}
				</p>
			</div>
		);
	}

	const messageKey =
		reason === "no_element"
			? "schema_editor.no_element"
			: reason === "no_schema"
				? "schema_editor.no_schema"
				: "schema_editor.no_fields";

	return (
		<div className="schema-editor-empty">
			<Empty
				image={<FileExclamationOutlined style={{ fontSize: 48, color: "#faad14" }} />}
				description={
					<>
						<div>{langtext(messageKey)}</div>
						{detail ? (
							<div style={{ marginTop: 8, color: "rgba(0,0,0,0.45)", fontSize: 12 }}>
								{detail}
							</div>
						) : null}
					</>
				}
			/>
		</div>
	);
};

export default SchemaEditorEmptyState;
