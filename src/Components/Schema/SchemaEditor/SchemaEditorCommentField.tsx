import React, { useMemo } from "react";
import { observer } from "mobx-react";
import { ISchemaFieldModel } from "../../../Stores/Models/SchemaField.Model";
import { IAsset } from "../../../Stores/Models/Asset.Model";
import { rootStore } from "../../../Stores/Root.Store";
import { isFieldRuleViolated, isMandatoryFieldUnfilledFromDisplay } from "../../../lib/schemaDeviation";
import { collectAssetIccmPresets } from "../../../lib/iccmNoteLink";
import IccmCommentControl from "../../Connections/IccmCommentControl";
import SchemaEditorFieldShell, { SchemaEditorFieldState } from "./SchemaEditorFieldShell";

type SchemaEditorCommentFieldProps = {
	field: ISchemaFieldModel;
	fieldKey?: string;
	value: string;
	canEdit: boolean;
	onChange?: (value: string) => void;
	isStructurallyMissing?: boolean;
	forceReadOnly?: boolean;
	mstPath?: string;
	mstValue?: unknown;
	schemaPath?: string;
	schemaTypeLabel?: string;
	validationPositive?: boolean;
	validationNegative?: boolean;
};

const SchemaEditorCommentField: React.FC<SchemaEditorCommentFieldProps> = ({
	field,
	value,
	canEdit,
	onChange,
	isStructurallyMissing = false,
	forceReadOnly = false,
	mstPath,
	mstValue,
	schemaPath,
	schemaTypeLabel,
	validationPositive = false,
	validationNegative = false,
}) => {
	const isReadOnly = forceReadOnly || field.itemFlags?.readonly || !canEdit;
	const liveRuleViolation = isFieldRuleViolated(field, value);
	const liveMandatoryUnfilled =
		canEdit &&
		!forceReadOnly &&
		!isStructurallyMissing &&
		isMandatoryFieldUnfilledFromDisplay(field, value);
	const hasContentError = liveMandatoryUnfilled || liveRuleViolation || isStructurallyMissing;
	const state: SchemaEditorFieldState = hasContentError ? "error" : "normal";
	const element = rootStore.ui.activeElement;
	const presets = useMemo(() => {
		if (!element || element.class !== "Asset") {
			return [];
		}
		return collectAssetIccmPresets(element as IAsset);
	}, [element]);

	return (
		<SchemaEditorFieldShell
			field={field}
			mode={canEdit ? "edit" : "view"}
			state={state}
			isStructurallyMissing={isStructurallyMissing}
			isMandatoryUnfilled={liveMandatoryUnfilled}
			hasRuleViolation={liveRuleViolation}
			mstPath={mstPath}
			mstValue={mstValue}
			schemaPath={schemaPath}
			schemaTypeLabel={schemaTypeLabel}
			validationPositive={validationPositive}
			validationNegative={validationNegative}
		>
			<IccmCommentControl
				value={value}
				onChange={onChange}
				canEdit={canEdit}
				disabled={isReadOnly}
				presets={presets}
				placeholder={field.example || ""}
			/>
		</SchemaEditorFieldShell>
	);
};

export default observer(SchemaEditorCommentField);
