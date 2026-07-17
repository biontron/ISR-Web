/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { useEffect, useRef, useState } from "react";
import { Input } from "antd";
import { ISchemaFieldModel } from "../../../Stores/Models/SchemaField.Model";
import { isFieldRuleViolated, isMandatoryFieldUnfilledFromDisplay } from "../../../lib/schemaDeviation";
import SchemaEditorFieldShell, { SchemaEditorFieldState } from "./SchemaEditorFieldShell";

interface FieldComponentProps {
	field: ISchemaFieldModel;
	fieldKey: string;
	onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	value: string;
	isStructurallyMissing?: boolean;
	forceReadOnly?: boolean;
	mstPath?: string;
	mstValue?: unknown;
	schemaPath?: string;
	schemaTypeLabel?: string;
}

const SchemaEditorFieldEdit: React.FC<FieldComponentProps> = ({
	field,
	fieldKey,
	onChange,
	value,
	isStructurallyMissing = false,
	forceReadOnly = false,
	mstPath,
	mstValue,
	schemaPath,
	schemaTypeLabel,
}) => {
	const [draft, setDraft] = useState(value);
	const inputRef = useRef<React.ComponentRef<typeof Input>>(null);
	const isReadOnly = forceReadOnly || field.itemFlags?.readonly;
	const liveRuleViolation = isFieldRuleViolated(field, draft);
	const liveMandatoryUnfilled =
		!forceReadOnly &&
		!isStructurallyMissing &&
		isMandatoryFieldUnfilledFromDisplay(field, draft);
	const hasContentError =
		liveMandatoryUnfilled || liveRuleViolation || isStructurallyMissing;
	const state: SchemaEditorFieldState = hasContentError ? "error" : "normal";

	useEffect(() => {
		const inputEl = inputRef.current?.input;
		if (inputEl && document.activeElement === inputEl) {
			return;
		}
		setDraft(value);
	}, [fieldKey, value]);

	const handleLocalChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setDraft(event.target.value);
		onChange(event);
	};

	return (
		<SchemaEditorFieldShell
			field={field}
			mode="edit"
			state={state}
			isStructurallyMissing={isStructurallyMissing}
			isMandatoryUnfilled={liveMandatoryUnfilled}
			hasRuleViolation={liveRuleViolation}
			mstPath={mstPath}
			mstValue={mstValue}
			schemaPath={schemaPath}
			schemaTypeLabel={schemaTypeLabel}
		>
			<Input
				ref={inputRef}
				className="schema-editor-field-input"
				value={draft}
				onChange={handleLocalChange}
				placeholder={field.example || ""}
				readOnly={isReadOnly}
			/>
		</SchemaEditorFieldShell>
	);
};

export default SchemaEditorFieldEdit;
