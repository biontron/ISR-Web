/*
# SPDX-License-Identifier: GPL-2.0*/

import React from "react";
import { observer } from "mobx-react";
import { Col, Row } from "antd";
import { rootStore } from "../../../Stores/Root.Store";
import SchemaEditorItem from "./SchemaEditorItem";
import SchemaEditorEmptyState from "./SchemaEditorEmptyState";
import { SchemaEditorContextProvider, useSchemaEditorContext } from "./SchemaEditorContext";
import type {
	SchemaChooseOnAddRequest,
	SchemaEditorWizardExtras,
} from "./SchemaEditorContext";
import { IElement } from "../../../Stores/Models/Element.Model";
import { ISchemaModel } from "../../../Stores/Models/Schema.Model";
import { ISchemaDefinition } from "../../../Interfaces/SchemaDefinition";
import { ISchemaItem } from "../../../Stores/Types/SchemaItem";
import type { ElementMarkFlags } from "../../../lib/elementXPathValidation";
import type { ValidationRuleRecord } from "../../../Stores/Models/ValidationRule.Model";
import { collectElementValidation } from "../../../lib/elementValidationChecks";
import { registerBuiltinSchemaWizards } from "./Wizards/registerBuiltinWizards";

registerBuiltinSchemaWizards();

export interface SchemaEditorProps {
	pathPrefix: string;
	schemaName?: string;
	schema?: ISchemaModel | ISchemaDefinition;
	schemaDefinition?: ISchemaModel | ISchemaDefinition;
	data?: IElement | null;
	elementData?: IElement | null;
	canEdit: boolean;
	fieldMarks?: ElementMarkFlags;
	validationRules?: readonly ValidationRuleRecord[];
	wizardExtras?: SchemaEditorWizardExtras;
	onChooseAdd?: (request: SchemaChooseOnAddRequest) => void;
	depth?: number;
}

function resolveFormItems(
	schemaDefinition: ISchemaModel | ISchemaDefinition
): ISchemaItem[] {
	const items = schemaDefinition.items ?? [];
	return [...items].sort((a, b) => a.order - b.order) as ISchemaItem[];
}

const SchemaEditorInner: React.FC<SchemaEditorProps> = ({
	schemaName,
	schema,
	schemaDefinition: passedSchemaDefinition,
	pathPrefix,
	data,
	elementData: passedElementData,
	canEdit,
	depth = 0,
}) => {
	const elementData = data ?? passedElementData ?? null;
	if (!elementData) {
		return <SchemaEditorEmptyState reason="no_element" />;
	}

	let schemaDefinition: ISchemaModel | ISchemaDefinition | undefined =
		schema ?? passedSchemaDefinition;

	if (!schemaDefinition && schemaName) {
		schemaDefinition =
			rootStore.configSchemas.findSchemaById(schemaName) ??
			rootStore.configSchemas.findSchemaByType(schemaName, "");
	}

	if (!schemaDefinition) {
		return (
			<SchemaEditorEmptyState
				reason="no_schema"
				detail={schemaName ? `„${schemaName}“` : undefined}
			/>
		);
	}

	const formItems = resolveFormItems(schemaDefinition);

	if (formItems.length === 0) {
		return (
			<SchemaEditorEmptyState
				reason="no_fields"
				detail={`„${schemaDefinition.id}“`}
			/>
		);
	}

	return (
		<div className={`schema-editor ${canEdit ? "schema-editor--edit" : "schema-editor--readonly"}`}>
			<Row gutter={[16, 16]}>
				<Col span={24}>
					{formItems.map((schemaDefinitionItem, index) => {
						const key = `${schemaDefinition!.id}_${schemaDefinitionItem.dataStructure.itemName}_${index}`;
						return (
							<SchemaEditorItem
								key={key}
								pathPrefix={pathPrefix}
								elementData={elementData}
								schemaDefinitionItem={schemaDefinitionItem as ISchemaItem}
								canEdit={canEdit}
								depth={depth}
							/>
						);
					})}
				</Col>
			</Row>
		</div>
	);
};

const SchemaEditor: React.FC<SchemaEditorProps> = (props) => {
	const parentContext = useSchemaEditorContext();
	const elementData = props.data ?? props.elementData ?? null;
	const validation = collectElementValidation(
		rootStore,
		elementData ?? undefined,
		props.validationRules
	);

	return (
		<SchemaEditorContextProvider
			value={{
				...parentContext,
				schemaName: props.schemaName ?? parentContext.schemaName,
				fieldMarks:
					props.fieldMarks ??
					parentContext.fieldMarks ??
					rootStore.ui.elementMarks.get(elementData?.id ?? "") ??
					validation.marks,
				wizardExtras: props.wizardExtras ?? parentContext.wizardExtras,
				requestChooseOnAdd: props.onChooseAdd ?? parentContext.requestChooseOnAdd,
			}}
		>
			<SchemaEditorInner {...props} />
		</SchemaEditorContextProvider>
	);
};

export default observer(SchemaEditor);
