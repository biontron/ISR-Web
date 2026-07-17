/*
# SPDX-License-Identifier: GPL-2.0*/

import React from "react";
import { observer } from "mobx-react";
import { Col, Row } from "antd";
import { rootStore } from "../../../Stores/Root.Store";
import SchemaEditorItem from "./SchemaEditorItem";
import SchemaEditorEmptyState from "./SchemaEditorEmptyState";
import { SchemaEditorContextProvider, useSchemaEditorContext } from "./SchemaEditorContext";
import { IElement } from "../../../Stores/Models/Element.Model";
import { ISchemaModel } from "../../../Stores/Models/Schema.Model";
import { ISchemaDefinition } from "../../../Interfaces/SchemaDefinition";
import { ISchemaItem } from "../../../Stores/Types/SchemaItem";

interface SchemaEditorProps {
	pathPrefix: string;
	schemaName?: string;
	schemaDefinition?: ISchemaModel | ISchemaDefinition;
	elementData?: IElement | null;
	canEdit: boolean;
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
	schemaDefinition: passedSchemaDefinition,
	pathPrefix,
	elementData,
	canEdit,
	depth = 0,
}) => {
	if (!elementData) {
		return <SchemaEditorEmptyState reason="no_element" />;
	}

	let schemaDefinition: ISchemaModel | ISchemaDefinition | undefined = passedSchemaDefinition;

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
		if (elementData.class === "View") {
			return <SchemaEditorEmptyState reason="no_view_settings" />;
		}
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
								schemaDefinitionItem={schemaDefinitionItem as any}
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

	return (
		<SchemaEditorContextProvider
			value={{
				...parentContext,
				schemaName: props.schemaName ?? parentContext.schemaName,
				dataEntryPath: props.pathPrefix,
			}}
		>
			<SchemaEditorInner {...props} />
		</SchemaEditorContextProvider>
	);
};

export default observer(SchemaEditor);
