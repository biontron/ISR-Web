import React from "react";
import { observer } from "mobx-react";
import CardCollapse from "../../../../Apps/AssetManagement/Components/CardCollapse.Component";
import { getLanguageText } from "../../../../lib/common";
import { getValueByPath } from "../../../../lib/path";
import { canAddCollectionEntry, isGroupUsageOutOfBounds } from "../../../../lib/schemaDeviation";
import { tryAssetMstAppend } from "../../../../lib/assetSchemaMutations";
import { IAsset } from "../../../../Stores/Models/Asset.Model";
import { ISchemaGroupModel } from "../../../../Stores/Models/SchemaGroup.Model";
import SchemaEditorDockpartEntry from "../SchemaEditorDockpartEntry";
import SchemaEditorGroupAddButton from "../SchemaEditorGroupAddButton";
import { useSchemaEditorContext } from "../SchemaEditorContext";
import type { SchemaWizardContext } from "../../../../lib/schemaWizards";

const DockpartsWizard: React.FC<SchemaWizardContext> = ({
	element,
	schemaItem,
	canEdit,
	depth = 0,
	mstPath,
}) => {
	const { requestChooseOnAdd } = useSchemaEditorContext();
	const group = schemaItem as ISchemaGroupModel;
	const fragment = getValueByPath(element, mstPath);
	const entries = Array.isArray(fragment) ? fragment : [];
	const usageCount = entries.length;
	const canAdd =
		canEdit &&
		(fragment === undefined ||
			fragment === null ||
			!Array.isArray(fragment) ||
			canAddCollectionEntry(group.maxUsage, fragment.length));
	const isUsageOutOfBounds = isGroupUsageOutOfBounds(element, mstPath, group);

	const handleAdd = () => {
		if (!requestChooseOnAdd) {
			return;
		}
		requestChooseOnAdd({
			path: mstPath,
			group,
			onComplete: (entry) => {
				const asset = element as IAsset;
				if (tryAssetMstAppend(asset, mstPath, entry)) {
					return;
				}
				element.addSchemaDefinitionItemByPath(mstPath, entry);
			},
			onCancel: () => undefined,
		});
	};

	const handleRemoveEntry = (index: number) => {
		if (entries.length <= group.minUsage) {
			return;
		}
		element.removeValueByPath(mstPath, index);
	};

	return (
		<CardCollapse
			title={getLanguageText(group.formProperties.label)}
			defaultCollapsed={group.formProperties.collapsed === true}
			hasContentWarning={isUsageOutOfBounds}
			depth={depth}
			actionElement={
				canEdit ? (
					<SchemaEditorGroupAddButton
						canAdd={canAdd}
						minUsage={group.minUsage}
						maxUsage={group.maxUsage}
						currentUsage={usageCount}
						onAdd={handleAdd}
						isUsageOutOfBounds={isUsageOutOfBounds}
					/>
				) : undefined
			}
		>
			{() => (
				<div className="schema-group schema-group--dynamic">
					{entries.map((entry, arrayIndex) => (
						<SchemaEditorDockpartEntry
							key={`${mstPath}[${arrayIndex}]`}
							entryPath={`${mstPath}[${arrayIndex}]`}
							dockpart={entry}
							elementData={element}
							canEdit={canEdit}
							arrayIndex={arrayIndex}
							total={entries.length}
							minUsage={group.minUsage}
							editAllowed={canEdit}
							entryDepth={depth + 1}
							onMoveUp={() => element.moveArrayEntryByPath(mstPath, arrayIndex, -1)}
							onMoveDown={() => element.moveArrayEntryByPath(mstPath, arrayIndex, 1)}
							onRemove={() => handleRemoveEntry(arrayIndex)}
						/>
					))}
				</div>
			)}
		</CardCollapse>
	);
};

export default observer(DockpartsWizard);
