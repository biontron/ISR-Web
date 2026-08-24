/*
# SPDX-License-Identifier: GPL-2.0*/
// SchemaEditorGroup.Component.tsx
import React, { useEffect } from "react";
import { observer } from "mobx-react";
import CardCollapse from "../../../Apps/AssetManagement/Components/CardCollapse.Component";
import { getLanguageText, useLangtext } from "../../../lib/common";
import { getValueByPath } from "../../../lib/path";
import {
	buildSchemaDataPath,
	findExtraPathsInScope,
	findStructuralMissingInScope,
	getGroupUsageCount,
	hasSchemaValidationErrorsInScope,
	isArrayCollectionGroup,
	canAddCollectionEntry,
	isGroupStructurallyMissing,
	isGroupUsageOutOfBounds,
	isFixedObjectGroup,
	isSchemaField,
	isSingleMapObjectGroup,
} from "../../../lib/schemaDeviation";
import { APPLICATION_ASSIGNED_DEFINITION_FIELD_NAMES } from "../../../lib/elementDefinitionTypes";
import { buildMandatoryGroupValue } from "../../../lib/schemaEntryDefaults";
import {
	isDockpartsChooseGroup,
	needsChooseOnAdd,
	tryAssetMstAppend,
} from "../../../lib/assetSchemaMutations";
import {
	createDefaultSchemaFieldItem,
	createDefaultSchemaGroupItem,
	isSchemaDefinitionItemsList,
	resolveSchemaItemEntryFormItems,
} from "../../../lib/schemaItemEditorMeta";
import SchemaEditorGroupAddButton from "./SchemaEditorGroupAddButton";
import SchemaEditorGroupEntryControls from "./SchemaEditorGroupEntryControls";
import SchemaEditorGroupEntryHeader from "./SchemaEditorGroupEntryHeader";
import SchemaEditorExtraData from "./SchemaEditorExtraData";
import SchemaEditorStructuralMissing from "./SchemaEditorStructuralMissing";
import { IElement } from "../../../Stores/Models/Element.Model";
import { ISchemaItem } from "../../../Stores/Types/SchemaItem";
import SchemaEditorDockpartEntry from "./SchemaEditorDockpartEntry";
import SchemaEditorItem from "./SchemaEditorItem";
import { ISchemaGroupModel } from "../../../Stores/Models/SchemaGroup.Model";
import { useSchemaEditorContext } from "./SchemaEditorContext";
import { buildSchemaEditorSchemaPath } from "../../../lib/schemaEditorFieldPath";
import { formatSchemaGroupTypeLabel } from "../../../lib/schemaEditorPathMeta";
import { IAsset } from "../../../Stores/Models/Asset.Model";

interface SchemaEditorGroupProps {
	pathPrefix: string;
	elementData: IElement;
	schemaDefinitionGroup: ISchemaGroupModel;
	canEdit: boolean;
	onAfterAdd?: (entryPath: string) => void;
	depth?: number;
}

type ElementDataFragment = unknown;

function mapDataEntries(data: unknown): [string, unknown][] {
	if (data == null || typeof data !== "object") {
		return [];
	}
	if (Array.isArray(data)) {
		return data.map((value, index) => [String(index), value]);
	}
	return Object.entries(data as Record<string, unknown>);
}

const SchemaEditorGroup: React.FC<SchemaEditorGroupProps> = ({
	pathPrefix,
	elementData,
	schemaDefinitionGroup,
	canEdit,
	onAfterAdd,
	depth = 0,
}) => {
	const langtext = useLangtext();
	const { requestChooseOnAdd, dataEntryPath, schemaName } = useSchemaEditorContext();
	const path = buildSchemaDataPath(pathPrefix, schemaDefinitionGroup);
	const schemaPath = buildSchemaEditorSchemaPath(
		dataEntryPath,
		pathPrefix,
		schemaDefinitionGroup.dataStructure.itemName
	);
	const elementDataFragment = getValueByPath(elementData, path) as ElementDataFragment;
	const usageCount = getGroupUsageCount(schemaDefinitionGroup, elementDataFragment);
	const isGroupMissing = isGroupStructurallyMissing(
		elementData,
		path,
		schemaDefinitionGroup
	);
	const schemaItemsGroupName = schemaDefinitionGroup.dataStructure.itemName;
	const isSchemaItemsList = isSchemaDefinitionItemsList(
		elementData,
		schemaItemsGroupName,
		elementDataFragment
	);
	const hasPresentData = (() => {
		if (elementDataFragment === undefined || elementDataFragment === null) {
			return false;
		}
		if (isArrayCollectionGroup(schemaDefinitionGroup)) {
			return Array.isArray(elementDataFragment) && elementDataFragment.length > 0;
		}
		if (Array.isArray(elementDataFragment) && elementDataFragment.length === 0) {
			return false;
		}
		return true;
	})();
	const shouldShowChildren =
		isSchemaItemsList ||
		schemaDefinitionGroup.minUsage > 0 ||
		usageCount > 0 ||
		hasPresentData;
	const isUsageOutOfBounds = isGroupUsageOutOfBounds(elementData, path, schemaDefinitionGroup);

	useEffect(() => {
		if (
			!canEdit ||
			!isGroupMissing ||
			isSchemaItemsList ||
			schemaDefinitionGroup.minUsage <= 0
		) {
			return;
		}
		const initial = buildMandatoryGroupValue(schemaDefinitionGroup);
		if (initial === undefined) {
			return;
		}
		elementData.setValueByPath(path, initial);
	}, [canEdit, elementData, isGroupMissing, path, schemaDefinitionGroup]);

	const childPathPrefix = path;
	const isDockpartsArray = isDockpartsChooseGroup(schemaDefinitionGroup);
	const structuralScopePaths =
		shouldShowChildren &&
		(isSchemaItemsList || isArrayCollectionGroup(schemaDefinitionGroup)) &&
		Array.isArray(elementDataFragment)
			? elementDataFragment.map((_, index) => `${path}[${index}]`)
			: shouldShowChildren
				? [childPathPrefix]
				: [];
	const structuralMissingEntries = isGroupMissing
		? [{ path, kind: "group" as const }]
		: isDockpartsArray
			? []
			: structuralScopePaths.flatMap((scopePath) =>
				findStructuralMissingInScope(elementData, schemaDefinitionGroup.items, scopePath)
			);
	const extraDataEntries = isDockpartsArray
		? []
		: structuralScopePaths.flatMap((scopePath) =>
			findExtraPathsInScope(elementData, schemaDefinitionGroup.items, scopePath)
		);

	const editAllowed = canEdit;
	const isArrayGroup = isArrayCollectionGroup(schemaDefinitionGroup);
	const showAddControls = isArrayGroup || isSchemaItemsList;
	const canAdd =
		editAllowed &&
		showAddControls &&
		(isSchemaItemsList ||
			elementDataFragment === undefined ||
			elementDataFragment === null ||
			!Array.isArray(elementDataFragment) ||
			canAddCollectionEntry(schemaDefinitionGroup.maxUsage, elementDataFragment.length));

	const handleAdd = () => {
		if (!elementData) {
			throw new Error("Element is undefined");
		}
		if (isSchemaItemsList) {
			handleAddSchemaField();
			return;
		}

		if (needsChooseOnAdd(schemaDefinitionGroup) && requestChooseOnAdd) {
			requestChooseOnAdd({
				path,
				group: schemaDefinitionGroup,
				onComplete: (entry) => {
					const asset = elementData as IAsset;
					if (tryAssetMstAppend(asset, path, entry)) {
						return;
					}
					elementData.addSchemaDefinitionItemByPath(path, entry);
				},
				onCancel: () => undefined,
			});
			return;
		}

		if (
			needsChooseOnAdd(schemaDefinitionGroup) &&
			elementData.class === "Asset" &&
			!requestChooseOnAdd
		) {
			const dockMatch = path.match(/^docks\[(\d+)\]\.dockparts$/);
			if (dockMatch) {
				return;
			}
		}

		const beforeLength = Array.isArray(elementDataFragment) ? elementDataFragment.length : 0;
		elementData.addValueByPath(pathPrefix, path, schemaDefinitionGroup);
		onAfterAdd?.(`${path}[${beforeLength}]`);
	};

	const handleAddSchemaField = () => {
		const beforeLength = Array.isArray(elementDataFragment) ? elementDataFragment.length : 0;
		elementData.addSchemaDefinitionItemByPath(
			path,
			createDefaultSchemaFieldItem(beforeLength + 1)
		);
		onAfterAdd?.(`${path}[${beforeLength}]`);
	};

	const handleAddSchemaGroup = () => {
		const beforeLength = Array.isArray(elementDataFragment) ? elementDataFragment.length : 0;
		elementData.addSchemaDefinitionItemByPath(
			path,
			createDefaultSchemaGroupItem(beforeLength + 1)
		);
		onAfterAdd?.(`${path}[${beforeLength}]`);
	};

	const handleRemoveEntry = (index: number) => {
		if (!Array.isArray(elementDataFragment)) {
			return;
		}
		if (
			!isSchemaItemsList &&
			elementDataFragment.length <= schemaDefinitionGroup.minUsage
		) {
			return;
		}
		elementData.removeValueByPath(path, index);
	};

	const handleMoveArrayEntry = (index: number, delta: -1 | 1) => {
		elementData.moveArrayEntryByPath(path, index, delta);
	};

	const handleMoveMapEntry = (key: string, delta: -1 | 1) => {
		elementData.moveMapEntryByPath(path, key, delta);
	};

	const entryDepth = depth + 1;

	const renderSchemaDefinitionListEntries = () => {
		if (!Array.isArray(elementDataFragment)) {
			return null;
		}

		return elementDataFragment.map((entry, index) => {
			const entryPath = `${path}[${index}]`;
			const kind = (entry as { kind?: string })?.kind;
			const formItems = resolveSchemaItemEntryFormItems(kind);
			const kindLabel = kind === "group" ? "Gruppe" : "Feld";
			const entryTitle = `${langtext("schema_editor.entry_label", { index: index + 1 })} (${kindLabel})`;
			const controls =
				editAllowed ? (
					<SchemaEditorGroupEntryControls
						canMoveUp={index > 0}
						canMoveDown={index < elementDataFragment.length - 1}
						canRemove
						onMoveUp={() => handleMoveArrayEntry(index, -1)}
						onMoveDown={() => handleMoveArrayEntry(index, 1)}
						onRemove={() => handleRemoveEntry(index)}
					/>
				) : null;

			const entryValue = elementDataFragment[index];

			return (
				<div
					key={entryPath}
					className="schema-group-entry schema-group-schema-item-entry"
					data-depth={entryDepth}
				>
					{renderEntryHeader(
						entryTitle,
						entryPath,
						entryValue,
						kind === "group" ? "group entry" : "field entry",
						controls
					)}
					<div className="schema-group-entry__body">
						{formItems.map((childItem, childIndex) => {
							if (!childItem) {
								return null;
							}
							const childKey = `${entryPath}.${(childItem as ISchemaItem).dataStructure.itemName}.${childIndex}`;
							return (
								<SchemaEditorItem
									key={childKey}
									pathPrefix={entryPath}
									elementData={elementData}
									schemaDefinitionItem={childItem as ISchemaItem}
									canEdit={canEdit}
									depth={entryDepth}
								/>
							);
						})}
					</div>
				</div>
			);
		});
	};

	const sortedGroupItems = [...schemaDefinitionGroup.items].sort((a, b) => a.order - b.order);

	const renderChildItems = (
		itemPathPrefix: string,
		keyPrefix: string,
		items: ISchemaItem[] = sortedGroupItems
	) =>
		items.map((childItem, index) => {
			if (!childItem) {
				return null;
			}
			const childKey = `${keyPrefix}.${childItem.dataStructure.itemName}.${index}`;
			return (
				<SchemaEditorItem
					key={childKey}
					pathPrefix={itemPathPrefix}
					elementData={elementData}
					schemaDefinitionItem={childItem}
					canEdit={canEdit}
					depth={entryDepth}
				/>
			);
		});

	const isDefinitionTypeField = (item: ISchemaItem) =>
		isSchemaField(item) &&
		APPLICATION_ASSIGNED_DEFINITION_FIELD_NAMES.has(item.dataStructure.itemName);

	const renderAnyDefinitionGroupChildren = () => {
		const typeItems = sortedGroupItems.filter(isDefinitionTypeField);
		const restItems = sortedGroupItems.filter((item) => !isDefinitionTypeField(item));
		const typeHasErrors =
			canEdit &&
			typeItems.length > 0 &&
			hasSchemaValidationErrorsInScope(elementData, typeItems, childPathPrefix);

		return (
			<>
				{typeItems.length > 0 ? (
					<CardCollapse
						title={langtext("general.element_definition_type")}
						defaultCollapsed
						hasContentError={typeHasErrors}
						depth={depth + 1}
					>
						{renderChildItems(childPathPrefix, `${childPathPrefix}.type`, typeItems)}
					</CardCollapse>
				) : null}
				{renderChildItems(childPathPrefix, childPathPrefix, restItems)}
			</>
		);
	};

	const isVariableMapGroup =
		schemaDefinitionGroup.collectionType === "map" &&
		!isFixedObjectGroup(schemaDefinitionGroup) &&
		!isSingleMapObjectGroup(schemaDefinitionGroup);

	const isDynamicGroup = isArrayGroup || isVariableMapGroup || isSchemaItemsList;
	const groupClassName = isDynamicGroup ? "schema-group schema-group--dynamic" : "schema-group schema-group--static";

	const renderEntryHeader = (
		title: string,
		entryPath: string,
		entryValue: unknown,
		schemaTypeLabel: string,
		controls?: React.ReactNode
	) => (
		<SchemaEditorGroupEntryHeader
			title={title}
			controls={controls}
			canEdit={canEdit}
			mstPath={entryPath}
			mstValue={entryValue}
			schemaPath={entryPath}
			schemaTypeLabel={schemaTypeLabel}
		/>
	);

	const renderArrayEntry = (arrayIndex: number, total: number) => {
		const entryPath = `${path}[${arrayIndex}]`;
		const entryTitle = langtext("schema_editor.entry_label", { index: arrayIndex + 1 });
		const controls =
			editAllowed ? (
				<SchemaEditorGroupEntryControls
					canMoveUp={arrayIndex > 0}
					canMoveDown={arrayIndex < total - 1}
					canRemove={total > schemaDefinitionGroup.minUsage}
					onMoveUp={() => handleMoveArrayEntry(arrayIndex, -1)}
					onMoveDown={() => handleMoveArrayEntry(arrayIndex, 1)}
					onRemove={() => handleRemoveEntry(arrayIndex)}
				/>
			) : null;

		const entryValue = Array.isArray(elementDataFragment)
			? elementDataFragment[arrayIndex]
			: undefined;

		return (
			<div
				key={entryPath}
				className="schema-group-entry schema-group-array-entry"
				data-depth={entryDepth}
			>
				{renderEntryHeader(
					entryTitle,
					entryPath,
					entryValue,
					"array entry",
					controls
				)}
				<div className="schema-group-entry__body">
					{renderChildItems(entryPath, entryPath)}
				</div>
			</div>
		);
	};

	const renderMapEntry = (mapKey: string, mapIndex: number, total: number) => {
		const entryPath = `${path}.${mapKey}`;
		const controls =
			editAllowed ? (
				<SchemaEditorGroupEntryControls
					canMoveUp={mapIndex > 0}
					canMoveDown={mapIndex < total - 1}
					onMoveUp={() => handleMoveMapEntry(mapKey, -1)}
					onMoveDown={() => handleMoveMapEntry(mapKey, 1)}
				/>
			) : null;

		const entryValue =
			elementDataFragment != null &&
			typeof elementDataFragment === "object" &&
			!Array.isArray(elementDataFragment)
				? (elementDataFragment as Record<string, unknown>)[mapKey]
				: undefined;

		return (
			<div
				key={entryPath}
				className="schema-group-entry schema-group-map-entry"
				data-depth={entryDepth}
			>
				{renderEntryHeader(
					mapKey,
					entryPath,
					entryValue,
					"map entry",
					controls
				)}
				<div className="schema-group-entry__body">
					{renderChildItems(entryPath, entryPath)}
				</div>
			</div>
		);
	};

	const renderGroupBody = () => {
		if (!shouldShowChildren) {
			return null;
		}

		if (isSchemaItemsList) {
			return renderSchemaDefinitionListEntries();
		}

		if (isArrayGroup && Array.isArray(elementDataFragment)) {
			if (isDockpartsChooseGroup(schemaDefinitionGroup)) {
				return elementDataFragment.map((entry, arrayIndex) => (
					<SchemaEditorDockpartEntry
						key={`${path}[${arrayIndex}]`}
						entryPath={`${path}[${arrayIndex}]`}
						dockpart={entry}
						elementData={elementData}
						canEdit={canEdit}
						arrayIndex={arrayIndex}
						total={elementDataFragment.length}
						minUsage={schemaDefinitionGroup.minUsage}
						editAllowed={editAllowed}
						entryDepth={entryDepth}
						onMoveUp={() => handleMoveArrayEntry(arrayIndex, -1)}
						onMoveDown={() => handleMoveArrayEntry(arrayIndex, 1)}
						onRemove={() => handleRemoveEntry(arrayIndex)}
					/>
				));
			}

			return elementDataFragment.map((_, arrayIndex) =>
				renderArrayEntry(arrayIndex, elementDataFragment.length)
			);
		}

		if (isArrayGroup) {
			return null;
		}

		if (
			isVariableMapGroup &&
			elementDataFragment &&
			typeof elementDataFragment === "object"
		) {
			const entries = mapDataEntries(elementDataFragment);
			return entries.map(([mapKey], mapIndex) =>
				renderMapEntry(mapKey, mapIndex, entries.length)
			);
		}

		if (schemaName === "ANY-DEFINITION" && schemaItemsGroupName === "definition") {
			return renderAnyDefinitionGroupChildren();
		}

		return renderChildItems(childPathPrefix, childPathPrefix);
	};

	const groupBody = renderGroupBody();

	return (
		<CardCollapse
			title={getLanguageText(schemaDefinitionGroup.formProperties.label)}
			hasContentError={isGroupMissing}
			hasContentWarning={!isGroupMissing && isUsageOutOfBounds}
			depth={depth}
			mstPath={canEdit ? path : undefined}
			mstValue={canEdit ? elementDataFragment : undefined}
			schemaPath={canEdit ? schemaPath : undefined}
			schemaTypeLabel={canEdit ? formatSchemaGroupTypeLabel(schemaDefinitionGroup) : undefined}
			actionElement={
				editAllowed && showAddControls ? (
					<SchemaEditorGroupAddButton
						canAdd={canAdd}
						minUsage={schemaDefinitionGroup.minUsage}
						maxUsage={schemaDefinitionGroup.maxUsage}
						currentUsage={usageCount}
						onAdd={handleAdd}
						onAddGroup={isSchemaItemsList ? handleAddSchemaGroup : undefined}
						isUsageOutOfBounds={isUsageOutOfBounds}
					/>
				) : undefined
			}
		>
			{groupBody ? <div className={groupClassName}>{groupBody}</div> : null}

			<SchemaEditorStructuralMissing entries={structuralMissingEntries} />
			<SchemaEditorExtraData entries={extraDataEntries} />
		</CardCollapse>
	);
};

export default observer(SchemaEditorGroup);
