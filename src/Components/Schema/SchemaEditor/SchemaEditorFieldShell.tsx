/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { ReactNode } from "react";
import { ISchemaFieldModel } from "../../../Stores/Models/SchemaField.Model";
import { getLanguageText, useLangtext } from "../../../lib/common";
import SchemaEditorPathTooltip from "./SchemaEditorPathTooltip";

export type SchemaEditorFieldState = "normal" | "error" | "warning";

interface SchemaEditorFieldShellProps {
	field: ISchemaFieldModel;
	mode: "edit" | "view";
	state?: SchemaEditorFieldState;
	children: ReactNode;
	isStructurallyMissing?: boolean;
	isMandatoryUnfilled?: boolean;
	hasRuleViolation?: boolean;
	mstPath?: string;
	mstValue?: unknown;
	schemaPath?: string;
	schemaTypeLabel?: string;
}

const SchemaEditorFieldShell: React.FC<SchemaEditorFieldShellProps> = ({
	field,
	mode,
	state = "normal",
	children,
	isStructurallyMissing = false,
	isMandatoryUnfilled = false,
	hasRuleViolation = false,
	mstPath,
	mstValue,
	schemaPath,
	schemaTypeLabel,
}) => {
	const langtext = useLangtext();
	const stateClass =
		state === "error"
			? "schema-editor-field--error"
			: state === "warning"
				? "schema-editor-field--warning"
				: "";

	const modeClass = mode === "edit" ? "Edit" : "View";
	const labelText = getLanguageText(field.formProperties.label);
	const labelContent =
		mstPath || schemaPath !== undefined ? (
			<SchemaEditorPathTooltip
				mstPath={mstPath}
				mstValue={mstValue}
				schemaPath={schemaPath}
				schemaTypeLabel={schemaTypeLabel}
			>
				<span className="schema-editor-field__label-text">{labelText}</span>
			</SchemaEditorPathTooltip>
		) : (
			labelText
		);

	return (
		<div className={`schema-editor-field Field ${modeClass} ${stateClass}`.trim()}>
			<label className="schema-editor-field__label">{labelContent}</label>
			<div className="schema-editor-field__control">{children}</div>
			{field.example ? (
				<div className="schema-editor-field__hint">{field.example}</div>
			) : null}
			{isStructurallyMissing && (
				<div className="schema-editor-field__message schema-editor-field__message--error">
					{langtext("schema_editor.structural_missing")}
				</div>
			)}
			{mode === "edit" && isMandatoryUnfilled && (
				<div className="schema-editor-field__message schema-editor-field__message--error">
					{langtext("schema_editor.mandatory_unfilled")}
				</div>
			)}
			{mode === "edit" && hasRuleViolation && (
				<div className="schema-editor-field__message schema-editor-field__message--error">
					{langtext("schema_editor.invalid_input")}
				</div>
			)}
		</div>
	);
};

export default SchemaEditorFieldShell;
