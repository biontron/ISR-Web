// === SchemaEditorField.Component.tsx (stabile Version) ===
import React, { useCallback, useEffect, useRef } from "react";
import { observer } from "mobx-react";
import { runInAction } from "mobx";
import { ISchemaFieldModel } from "../../../Stores/Models/SchemaField.Model";
import { getValueByPath } from "../../../lib/path";
import {
	formatSchemaFieldDisplayValue,
	isMultilingualTextValue,
} from "../../../lib/common";
import { rootStore } from "../../../Stores/Root.Store";
import {
	getFieldDefaultValue,
	isFieldRuleViolated,
	isFieldStructurallyMissing,
	isMandatoryFieldUnfilled,
} from "../../../lib/schemaDeviation";
import { resolveSchemaDocumentFieldPath } from "../../../lib/schemaDocumentFieldPath";
import { buildSchemaEditorSchemaPath } from "../../../lib/schemaEditorFieldPath";
import { formatSchemaFieldTypeLabel } from "../../../lib/schemaEditorPathMeta";
import { isApplicationAssignedDefinitionField } from "../../../lib/elementDefinitionTypes";
import {
	isSchemaAssignedIdField,
	resolveAssignedIdAddContext,
} from "../../../lib/schemaEditorAssignedFields";
import { resolveFieldValueOnAdd } from "../../../lib/schemaAddFieldDefaults";
import SchemaEditorFieldEdit from "./SchemaEditorFieldEdit";
import SchemaEditorFieldView from "./SchemaEditorFieldView";
import SchemaEditorValueRefField from "./SchemaEditorValueRefField";
import { IElement } from "../../../Stores/Models/Element.Model";
import { useSchemaEditorContext } from "./SchemaEditorContext";

interface FieldComponentProps {
	pathPrefix: string;
	elementData: IElement;
	schemaDefinitionField: ISchemaFieldModel;
	canEdit: boolean;
}

function isPlainLanguageRecord(value: unknown): value is Record<string, unknown> {
	if (value == null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	if (isMultilingualTextValue(value)) {
		return false;
	}
	const record = value as Record<string, unknown>;
	return (
		typeof record.und === "string" ||
		Object.values(record).some((entry) => typeof entry === "string")
	);
}

const SchemaEditorField: React.FC<FieldComponentProps> = ({
	pathPrefix,
	elementData,
	schemaDefinitionField,
	canEdit,
}) => {
	const { schemaName, dataEntryPath } = useSchemaEditorContext();
	const resolvedPath = resolveSchemaDocumentFieldPath(
		elementData,
		schemaDefinitionField,
		pathPrefix
	);
	const isOmittedField = resolvedPath === null;
	const mstPath = resolvedPath ?? "";
	const schemaPath = buildSchemaEditorSchemaPath(
		dataEntryPath,
		pathPrefix,
		schemaDefinitionField.dataStructure.itemName
	);
	const fieldKey = `${elementData.id}:${mstPath}`;
	const defaultsAppliedRef = useRef(false);
	const isApplicationAssignedField =
		(schemaName === "ANY-DEFINITION" &&
			isApplicationAssignedDefinitionField(
				elementData,
				schemaDefinitionField.dataStructure.itemName,
				mstPath
			)) ||
		isSchemaAssignedIdField(
			schemaName,
			schemaDefinitionField.dataStructure.itemName,
			mstPath
		);

	const convertValue = useCallback((val: unknown): string => {
		return formatSchemaFieldDisplayValue(val, schemaDefinitionField.fieldType);
	}, [schemaDefinitionField.fieldType]);

	const externalValue = isOmittedField ? undefined : getValueByPath(elementData, mstPath);
	const value = convertValue(externalValue);
	const isMandatoryUnfilled = isOmittedField
		? false
		: isMandatoryFieldUnfilled(elementData, mstPath, schemaDefinitionField);
	const isStructurallyMissing = isOmittedField
		? false
		: isFieldStructurallyMissing(elementData, mstPath, schemaDefinitionField);
	const hasRuleViolation = isOmittedField
		? false
		: isFieldRuleViolated(schemaDefinitionField, value);

	useEffect(() => {
		defaultsAppliedRef.current = false;
	}, [fieldKey, canEdit]);

	useEffect(() => {
		if (isOmittedField || !canEdit || defaultsAppliedRef.current) {
			return;
		}

		const isAssignedIdField = isSchemaAssignedIdField(
			schemaName,
			schemaDefinitionField.dataStructure.itemName,
			mstPath
		);

		if (isAssignedIdField) {
			const current = getValueByPath(elementData, mstPath);
			if (current !== undefined && current !== "") {
				defaultsAppliedRef.current = true;
				return;
			}

			const addContext = resolveAssignedIdAddContext(mstPath);
			if (addContext) {
				const generated = resolveFieldValueOnAdd(schemaDefinitionField, {
					element: elementData,
					...addContext,
				});
				if (generated !== undefined && generated !== "") {
					elementData.setValueByPath(mstPath, generated);
				}
			}
			defaultsAppliedRef.current = true;
			return;
		}

		if (isApplicationAssignedField) {
			return;
		}

		const structurallyMissing = isFieldStructurallyMissing(
			elementData,
			mstPath,
			schemaDefinitionField
		);
		const unfilled = isMandatoryFieldUnfilled(
			elementData,
			mstPath,
			schemaDefinitionField
		);
		if (!structurallyMissing && !unfilled) {
			defaultsAppliedRef.current = true;
			return;
		}

		const defaultValue = getFieldDefaultValue(schemaDefinitionField);
		if (defaultValue === undefined) {
			defaultsAppliedRef.current = true;
			return;
		}

		elementData.setValueByPath(mstPath, defaultValue);
		defaultsAppliedRef.current = true;
	}, [canEdit, mstPath, elementData, fieldKey, isApplicationAssignedField, isOmittedField, schemaDefinitionField]);

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (isApplicationAssignedField) {
			return;
		}
		const newValue = event.target.value;

		if (isMultilingualTextValue(externalValue)) {
			runInAction(() => {
				externalValue.set(rootStore.i18n.lang, newValue);
			});
			return;
		}

		if (isPlainLanguageRecord(externalValue)) {
			const lang = rootStore.i18n.lang;
			elementData.setValueByPath(mstPath, {
				...externalValue,
				[lang]: newValue,
			});
			return;
		}

		let convertedValue: unknown = newValue;
		const ft = schemaDefinitionField.fieldType;

		if (ft === "number") convertedValue = newValue === "" ? null : Number(newValue);
		else if (ft === "boolean") convertedValue = newValue.toLowerCase() === "true";
		else if (ft === "object" || ft === "array") {
			try {
				convertedValue = JSON.parse(newValue);
			} catch {
				convertedValue = newValue;
			}
		}

		elementData.setValueByPath(mstPath, convertedValue);
	};

	if (isOmittedField) {
		return null;
	}

	const isValueRefField =
		schemaDefinitionField.fieldType === "valueRef" ||
		schemaDefinitionField.fieldType === "componentRef";

	if (isValueRefField) {
		return (
			<SchemaEditorValueRefField
				field={schemaDefinitionField}
				value={externalValue}
				canEdit={canEdit && !isApplicationAssignedField}
				onChange={(next) => elementData.setValueByPath(mstPath, next)}
				mstPath={mstPath}
				schemaPath={schemaPath}
			/>
		);
	}

	if (!canEdit) {
		return (
			<SchemaEditorFieldView
				field={schemaDefinitionField}
				value={value}
				isMandatoryUnfilled={isMandatoryUnfilled}
				isStructurallyMissing={isStructurallyMissing}
				hasRuleViolation={hasRuleViolation}
			/>
		);
	}

	return (
		<SchemaEditorFieldEdit
			fieldKey={fieldKey}
			field={schemaDefinitionField}
			value={value}
			onChange={handleChange}
			isStructurallyMissing={isStructurallyMissing}
			forceReadOnly={isApplicationAssignedField}
			mstPath={mstPath}
			mstValue={externalValue}
			schemaPath={schemaPath}
			schemaTypeLabel={formatSchemaFieldTypeLabel(schemaDefinitionField)}
		/>
	);
};

export default observer(SchemaEditorField);
