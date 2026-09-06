import React from "react";
import { observer } from "mobx-react";
import SchemaEditor from "./SchemaEditor.Component";
import SchemaEditorEmptyState from "./SchemaEditorEmptyState";
import SchemaEditorGroupEntryControls from "./SchemaEditorGroupEntryControls";
import SchemaEditorGroupEntryHeader from "./SchemaEditorGroupEntryHeader";
import SchemaEditorDockpartHeader from "./SchemaEditorDockpartHeader";
import { findDockForEntryPath } from "./SchemaEditorDockpartBasedOn";
import { useLangtext } from "../../../lib/common";
import { resolveDockpartEntrySchemaDefinition } from "../../../lib/dockpartSchemaResolve";
import { rootStore } from "../../../Stores/Root.Store";
import { IElement } from "../../../Stores/Models/Element.Model";

interface SchemaEditorDockpartEntryProps {
	entryPath: string;
	dockpart: unknown;
	elementData: IElement;
	canEdit: boolean;
	arrayIndex: number;
	total: number;
	minUsage: number;
	editAllowed: boolean;
	entryDepth?: number;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onRemove: () => void;
}

const SchemaEditorDockpartEntry: React.FC<SchemaEditorDockpartEntryProps> = ({
	entryPath,
	dockpart,
	elementData,
	canEdit,
	arrayIndex,
	total,
	minUsage,
	editAllowed,
	entryDepth = 1,
	onMoveUp,
	onMoveDown,
	onRemove,
}) => {
	const langtext = useLangtext();
	const dockpartType =
		dockpart != null && typeof dockpart === "object"
			? String((dockpart as { type?: unknown }).type ?? "")
			: "";
	const resolvedSchema = resolveDockpartEntrySchemaDefinition(
		dockpart,
		rootStore.configSchemas.dockparts
	);
	const dock = findDockForEntryPath(elementData, entryPath);
	const entryTitle = langtext("schema_editor.entry_label", { index: arrayIndex + 1 });
	const typeSuffix = dockpartType ? ` (${dockpartType})` : "";
	const controls =
		editAllowed ? (
			<SchemaEditorGroupEntryControls
				canMoveUp={arrayIndex > 0}
				canMoveDown={arrayIndex < total - 1}
				canRemove={total > minUsage}
				onMoveUp={onMoveUp}
				onMoveDown={onMoveDown}
				onRemove={onRemove}
			/>
		) : null;

	return (
		<div
			className="schema-group-entry schema-group-array-entry schema-group-dockpart-entry"
			data-depth={entryDepth}
		>
			<SchemaEditorGroupEntryHeader
				title={`${entryTitle}${typeSuffix}`}
				controls={controls}
				canEdit={canEdit}
				mstPath={entryPath}
				schemaPath={entryPath}
				schemaTypeLabel={
					dockpartType
						? `dockpart · ${dockpartType}`
						: "dockpart entry"
				}
			/>
			<div className="schema-group-entry__body">
				<SchemaEditorDockpartHeader
					dockpart={dockpart}
					dock={dock}
					elementData={elementData}
					canEdit={canEdit}
					schemas={rootStore.configSchemas.dockparts}
				/>
				{resolvedSchema ? (
					<SchemaEditor
						schemaDefinition={resolvedSchema}
						pathPrefix={entryPath}
						elementData={elementData}
						canEdit={canEdit}
						depth={entryDepth}
					/>
				) : (
					<SchemaEditorEmptyState
						reason="no_dockpart_schema"
						detail={dockpartType || undefined}
					/>
				)}
			</div>
		</div>
	);
};

export default observer(SchemaEditorDockpartEntry);
