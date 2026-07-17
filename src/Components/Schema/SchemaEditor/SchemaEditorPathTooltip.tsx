import React, { ReactNode } from "react";
import { Tooltip } from "antd";
import { useLangtext } from "../../../lib/common";
import { formatMstValuePreview } from "../../../lib/schemaEditorPathMeta";

interface SchemaEditorPathTooltipProps {
	mstPath?: string;
	mstValue?: unknown;
	schemaPath?: string;
	schemaTypeLabel?: string;
	children: ReactNode;
}

const SchemaEditorPathTooltip: React.FC<SchemaEditorPathTooltipProps> = ({
	mstPath,
	mstValue,
	schemaPath,
	schemaTypeLabel,
	children,
}) => {
	const langtext = useLangtext();

	if (!mstPath && schemaPath === undefined) {
		return <>{children}</>;
	}

	return (
		<Tooltip
			mouseEnterDelay={0.25}
			overlayClassName="schema-editor-field-path-tooltip-overlay"
			title={
				<div className="schema-editor-field-path-tooltip">
					{mstPath ? (
						<div className="schema-editor-field-path-tooltip__row">
							<span className="schema-editor-field-path-tooltip__label">
								{langtext("schema_editor.path_mst")}:
							</span>
							<div className="schema-editor-field-path-tooltip__detail">
								<code>{mstPath}</code>
								<span className="schema-editor-field-path-tooltip__meta">
									→ {formatMstValuePreview(mstValue)}
								</span>
							</div>
						</div>
					) : null}
					{schemaPath !== undefined ? (
						<div className="schema-editor-field-path-tooltip__row">
							<span className="schema-editor-field-path-tooltip__label">
								{langtext("schema_editor.path_schema")}:
							</span>
							<div className="schema-editor-field-path-tooltip__detail">
								<code>{schemaPath || "(root)"}</code>
								{schemaTypeLabel ? (
									<span className="schema-editor-field-path-tooltip__meta">
										· {schemaTypeLabel}
									</span>
								) : null}
							</div>
						</div>
					) : null}
				</div>
			}
		>
			{children}
		</Tooltip>
	);
};

export default SchemaEditorPathTooltip;
