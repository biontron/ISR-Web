import React from "react";
import { observer } from "mobx-react";
import { ISchemaFieldModel } from "../../../../Stores/Models/SchemaField.Model";
import { getValueByPath } from "../../../../lib/path";
import { formatSchemaFieldDisplayValue } from "../../../../lib/common";
import SchemaEditorCommentField from "../SchemaEditorCommentField";
import { formatSchemaFieldTypeLabel } from "../../../../lib/schemaEditorPathMeta";
import { fieldPathHasMark } from "../../../../lib/elementXPathValidation";
import { useSchemaEditorContext } from "../SchemaEditorContext";
import type { SchemaWizardContext } from "../../../../lib/schemaWizards";

const MarkdownWizard: React.FC<SchemaWizardContext> = ({
	element,
	schemaItem,
	canEdit,
	mstPath,
}) => {
	const { fieldMarks } = useSchemaEditorContext();
	const field = schemaItem as ISchemaFieldModel;
	const externalValue = getValueByPath(element, mstPath);
	const value = formatSchemaFieldDisplayValue(externalValue, field.fieldType);
	const schemaPath = mstPath;
	const applyRawValue = (newValue: string) => {
		element.setValueByPath(mstPath, newValue);
	};
	const marks = fieldMarks ?? { fieldPaths: [], positive: false, negative: false };
	const marked = fieldPathHasMark(mstPath, marks.fieldPaths ?? []);

	return (
		<SchemaEditorCommentField
			field={field}
			value={value}
			canEdit={canEdit}
			onChange={applyRawValue}
			element={element}
			mstPath={mstPath}
			mstValue={externalValue}
			schemaPath={schemaPath}
			schemaTypeLabel={formatSchemaFieldTypeLabel(field)}
			validationPositive={marked && !!marks.positive}
			validationNegative={marked && !!marks.negative}
		/>
	);
};

export default observer(MarkdownWizard);
