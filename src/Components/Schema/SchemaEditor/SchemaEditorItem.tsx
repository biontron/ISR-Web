import React from "react";
import SchemaEditorField from "./SchemaEditorField.Component";
import SchemaEditorGroup from "./SchemaEditorGroup.Component";
import { ISchemaGroupModel } from "../../../Stores/Models/SchemaGroup.Model";
import { ISchemaFieldModel } from "../../../Stores/Models/SchemaField.Model";
import { IElement } from "../../../Stores/Models/Element.Model";
import { ISchemaItem } from "../../../Stores/Types/SchemaItem";
import { resolveSchemaWizard } from "../../../lib/schemaWizards";
import { isSchemaItemHidden, resolveSchemaItemLocation } from "../../../lib/schemaEditorLocation";
import { buildSchemaDataPath } from "../../../lib/schemaDeviation";
import { useSchemaEditorContext } from "./SchemaEditorContext";

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
	const { wizardExtras } = useSchemaEditorContext();
	if (!schemaDefinitionItem) {
		return <div>No schema definiton item</div>;
	}

	const location = resolveSchemaItemLocation(elementData, schemaDefinitionItem, pathPrefix);
	const itemName = schemaDefinitionItem.dataStructure?.itemName ?? "";
	const isDockCollection =
		schemaDefinitionItem.kind === "group" &&
		(itemName === "docks" || itemName === "dockparts");
	if (isSchemaItemHidden(schemaDefinitionItem)) {
		return null;
	}
	if (!location.visible && !isDockCollection) {
		return null;
	}

	const mstPath =
		isDockCollection && schemaDefinitionItem.kind === "group"
			? buildSchemaDataPath(pathPrefix, schemaDefinitionItem as ISchemaGroupModel)
			: location.mstPath;

	const wizard = resolveSchemaWizard(schemaDefinitionItem);
	if (wizard) {
		const Wizard = wizard.component;
		return (
			<Wizard
				element={elementData}
				schemaItem={schemaDefinitionItem}
				pathPrefix={pathPrefix}
				canEdit={canEdit}
				depth={depth}
				mstPath={mstPath}
				extras={wizardExtras}
			/>
		);
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
