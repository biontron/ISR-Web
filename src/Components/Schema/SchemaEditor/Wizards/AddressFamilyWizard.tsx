import React from "react";
import { observer } from "mobx-react";
import { ISchemaGroupModel } from "../../../../Stores/Models/SchemaGroup.Model";
import { ISchemaItem } from "../../../../Stores/Types/SchemaItem";
import { hasSchemaValidationErrorsInScope } from "../../../../lib/schemaDeviation";
import { getLanguageText } from "../../../../lib/common";
import { interpolateTitleTemplate } from "../../../../lib/titleTemplate";
import { getValueByPath } from "../../../../lib/path";
import CardCollapse from "../../../../Apps/AssetManagement/Components/CardCollapse.Component";
import SchemaEditorItem from "../SchemaEditorItem";
import SchemaEditorPathTitle from "../SchemaEditorPathTitle";
import type { SchemaWizardContext } from "../../../../lib/schemaWizards";

const AddressFamilyWizard: React.FC<SchemaWizardContext> = ({
	element,
	schemaItem,
	canEdit,
	depth = 0,
	mstPath,
}) => {
	const group = schemaItem as ISchemaGroupModel;
	const items = [...(group.items ?? [])].sort((a, b) => a.order - b.order) as ISchemaItem[];
	const hasChildErrors =
		canEdit && hasSchemaValidationErrorsInScope(element, items, mstPath);
	const groupLabel = getLanguageText(group.formProperties.label);
	const fragment = getValueByPath(element, mstPath);
	const titleTemplate = group.formProperties.titleTemplate?.trim();
	const summaryTitle = titleTemplate
		? interpolateTitleTemplate(titleTemplate, fragment, groupLabel, {
				root: element,
				basePath: mstPath,
			})
		: groupLabel;

	return (
		<CardCollapse
			title={
				<SchemaEditorPathTitle
					title={summaryTitle}
					mstPath={canEdit ? mstPath : undefined}
					mstValue={fragment}
					schemaPath={canEdit ? mstPath : undefined}
				/>
			}
			defaultCollapsed={group.formProperties.collapsed === true}
			hasContentError={hasChildErrors}
			depth={depth}
		>
			<div
				className={`schema-wizard-address ${hasChildErrors ? "schema-wizard-address--error" : ""}`}
			>
				{items.map((child, index) => (
					<SchemaEditorItem
						key={`${mstPath}.${child.dataStructure.itemName}.${index}`}
						pathPrefix={mstPath}
						elementData={element}
						schemaDefinitionItem={child}
						canEdit={canEdit}
						depth={depth + 1}
					/>
				))}
			</div>
		</CardCollapse>
	);
};

export default observer(AddressFamilyWizard);
