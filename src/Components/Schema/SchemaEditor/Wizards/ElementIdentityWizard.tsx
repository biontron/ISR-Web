import React from "react";
import { observer } from "mobx-react";
import { ISchemaGroupModel } from "../../../../Stores/Models/SchemaGroup.Model";
import { ISchemaItem } from "../../../../Stores/Types/SchemaItem";
import { hasSchemaValidationErrorsInScope, isSchemaField } from "../../../../lib/schemaDeviation";
import { APPLICATION_ASSIGNED_DEFINITION_FIELD_NAMES } from "../../../../lib/elementDefinitionTypes";
import { getLanguageText } from "../../../../lib/common";
import {
	ELEMENT_IDENTITY_TITLE_TEMPLATE,
	interpolateTitleTemplate,
} from "../../../../lib/titleTemplate";
import { getValueByPath } from "../../../../lib/path";
import { rootStore } from "../../../../Stores/Root.Store";
import CardCollapse from "../../../../Apps/AssetManagement/Components/CardCollapse.Component";
import SchemaSvgIcon from "../../SchemaSvgIcon";
import SchemaEditorItem from "../SchemaEditorItem";
import SchemaEditorPathTitle from "../SchemaEditorPathTitle";
import type { SchemaWizardContext } from "../../../../lib/schemaWizards";

const TYPE_FIELD_NAMES = new Set(["baseType", "type", "subType", "storeType"]);
const NAME_FIELD_NAMES = new Set(["name", "label"]);

const ElementIdentityWizard: React.FC<SchemaWizardContext> = ({
	element,
	schemaItem,
	canEdit,
	depth = 0,
	mstPath,
}) => {
	const group = schemaItem as ISchemaGroupModel;
	const items = [...(group.items ?? [])].sort((a, b) => a.order - b.order) as ISchemaItem[];
	const typeItems = items.filter(
		(item) =>
			isSchemaField(item) &&
			(TYPE_FIELD_NAMES.has(item.dataStructure.itemName) ||
				APPLICATION_ASSIGNED_DEFINITION_FIELD_NAMES.has(item.dataStructure.itemName))
	);
	const nameItems = items.filter(
		(item) => isSchemaField(item) && NAME_FIELD_NAMES.has(item.dataStructure.itemName)
	);
	const restItems = items.filter((item) => !typeItems.includes(item) && !nameItems.includes(item));
	const definition = getValueByPath(element, mstPath) as
		| { type?: string; subType?: string; baseType?: string; name?: string; label?: string }
		| undefined;
	const icon = rootStore.configSchemas.getIconByDefinition(definition ?? {});
	const hasChildErrors =
		canEdit && hasSchemaValidationErrorsInScope(element, items, mstPath);
	const groupLabel = getLanguageText(group.formProperties.label);
	const titleTemplate =
		group.formProperties.titleTemplate?.trim() || ELEMENT_IDENTITY_TITLE_TEMPLATE;
	const summaryTitle = interpolateTitleTemplate(titleTemplate, definition, groupLabel, {
		root: element,
		basePath: mstPath,
	});

	const renderItems = (list: ISchemaItem[], keyPrefix: string) =>
		list.map((child, index) => (
			<SchemaEditorItem
				key={`${keyPrefix}.${child.dataStructure.itemName}.${index}`}
				pathPrefix={mstPath}
				elementData={element}
				schemaDefinitionItem={child}
				canEdit={canEdit}
				depth={depth + 1}
			/>
		));

	const heading = (text: string) => (
		<span className="schema-wizard-identity__summary">
			<SchemaSvgIcon svgString={icon} element={definition ?? {}} />
			<SchemaEditorPathTitle
				title={text}
				mstPath={canEdit ? mstPath : undefined}
				mstValue={definition}
				schemaPath={canEdit ? mstPath : undefined}
				schemaTypeLabel={canEdit ? "elementIdentity" : undefined}
			/>
		</span>
	);

	return (
		<CardCollapse
			title={heading(groupLabel)}
			summary={summaryTitle && summaryTitle !== groupLabel ? heading(summaryTitle) : undefined}
			defaultCollapsed={group.formProperties.collapsed !== false}
			hasContentError={hasChildErrors}
			depth={depth}
		>
			<div className={`schema-wizard-identity ${hasChildErrors ? "schema-wizard-identity--error" : ""}`}>
				<div className="schema-wizard-identity__header">
					<div className="schema-wizard-identity__types">{renderItems(typeItems, `${mstPath}.type`)}</div>
				</div>
				<div className="schema-wizard-identity__names">{renderItems(nameItems, `${mstPath}.name`)}</div>
				<div className="schema-wizard-identity__rest">{renderItems(restItems, mstPath)}</div>
			</div>
		</CardCollapse>
	);
};

export default observer(ElementIdentityWizard);
