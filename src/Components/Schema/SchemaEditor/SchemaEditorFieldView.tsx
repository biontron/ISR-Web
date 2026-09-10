/*
# SPDX-License-Identifier: GPL-2.0*/

import React from "react";
import { ISchemaFieldModel } from "../../../Stores/Models/SchemaField.Model";
import SchemaEditorFieldShell, { SchemaEditorFieldState } from "./SchemaEditorFieldShell";

interface FieldComponentProps {
	field: ISchemaFieldModel;
	value: string;
	isMandatoryUnfilled?: boolean;
	isStructurallyMissing?: boolean;
	hasRuleViolation?: boolean;
	validationPositive?: boolean;
	validationNegative?: boolean;
	mstPath?: string;
}

const SchemaEditorFieldView: React.FC<FieldComponentProps> = ({
	field,
	value,
	isMandatoryUnfilled = false,
	isStructurallyMissing = false,
	hasRuleViolation = false,
	validationPositive = false,
	validationNegative = false,
	mstPath,
}) => {
	const hasContentError = isMandatoryUnfilled || hasRuleViolation || isStructurallyMissing;
	const state: SchemaEditorFieldState = hasContentError ? "error" : "normal";
	const displayValue = value || "\u00a0";

	return (
		<SchemaEditorFieldShell
			field={field}
			mode="view"
			state={state}
			isStructurallyMissing={isStructurallyMissing}
			mstPath={mstPath}
			validationPositive={validationPositive}
			validationNegative={validationNegative}
		>
			<div className="schema-editor-field-value Input">{displayValue}</div>
		</SchemaEditorFieldShell>
	);
};

export default SchemaEditorFieldView;
