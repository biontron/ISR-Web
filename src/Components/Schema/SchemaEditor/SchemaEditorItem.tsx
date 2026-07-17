import React from "react";
import SchemaEditorField from "./SchemaEditorField.Component";
import SchemaEditorGroup from "./SchemaEditorGroup.Component";
import { ISchemaGroupModel } from "../../../Stores/Models/SchemaGroup.Model";
import { ISchemaFieldModel } from "../../../Stores/Models/SchemaField.Model";
import { IElement } from "../../../Stores/Models/Element.Model";
import { ISchemaItem } from "../../../Stores/Types/SchemaItem";

interface SchemaEditorItemProps {
	key: string;
	pathPrefix: string;
	elementData: IElement;
	schemaDefinitionItem: ISchemaItem;
	canEdit: boolean;
	depth?: number;
}

const SchemaEditorItem: React.FC<SchemaEditorItemProps> = ({
	pathPrefix,
	elementData,
	schemaDefinitionItem,
	canEdit,
	depth = 0,
}) => {
	if (!schemaDefinitionItem) {
		return <div>No schema definiton item</div>;
	}

	const isField = schemaDefinitionItem.kind === "field";
	const isGroup = schemaDefinitionItem.kind === "group";

	if (isField) {
		return (
			<SchemaEditorField
				pathPrefix={pathPrefix}
				elementData={elementData}
				schemaDefinitionField={schemaDefinitionItem as ISchemaFieldModel}
				canEdit={canEdit}
			/>
		);
	}

	if (isGroup) {
		return (
			<SchemaEditorGroup
				pathPrefix={pathPrefix}
				elementData={elementData}
				schemaDefinitionGroup={schemaDefinitionItem as ISchemaGroupModel}
				canEdit={canEdit}
				depth={depth}
			/>
		);
	}

	throw new Error(
		`Item is neither of type 'SchemaField', nor 'SchemaGroup'. PathPrefix: ${pathPrefix}`
	);
};

export default SchemaEditorItem;
