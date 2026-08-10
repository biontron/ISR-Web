import React from "react";
import { Select } from "antd";
import { observer } from "mobx-react";
import { rootStore } from "../../../Stores/Root.Store";
import {
	buildContextValueReference,
	isValueReference,
	resolveValueReference,
} from "../../../lib/valueReferenceResolve";
import SchemaEditorFieldShell, { SchemaEditorFieldState } from "./SchemaEditorFieldShell";
import { ISchemaFieldModel } from "../../../Stores/Models/SchemaField.Model";
import { IGroup } from "../../../Stores/Models/Group.Model";

interface SchemaEditorValueRefFieldProps {
	field: ISchemaFieldModel;
	value: unknown;
	canEdit: boolean;
	onChange: (next: unknown) => void;
	mstPath?: string;
	schemaPath?: string;
}

function groupDisplayName(group: IGroup): string {
	return group.definition?.label?.trim() || group.definition?.name?.trim() || group.id;
}

const SchemaEditorValueRefField: React.FC<SchemaEditorValueRefFieldProps> = ({
	field,
	value,
	canEdit,
	onChange,
	mstPath,
	schemaPath,
}) => {
	const allGroups = rootStore.groups.groups.slice();
	const allAssets = rootStore.assets.assets.slice();
	const options = allGroups.map((group) => ({
		value: group.id,
		label: groupDisplayName(group),
	}));

	const isContextField =
		field.fieldType === "valueRef" || field.fieldType === "contextValueRef";
	const selectedGroupRef = isValueReference(value)
		? value.contextGroupRef ?? value.componentRef
		: undefined;

	const resolved = resolveValueReference(value, {
		assets: allAssets,
		groups: allGroups,
	});
	const state: SchemaEditorFieldState = "normal";

	return (
		<SchemaEditorFieldShell
			field={field}
			mode={canEdit ? "edit" : "view"}
			state={state}
			mstPath={mstPath}
			mstValue={value}
			schemaPath={schemaPath}
			schemaTypeLabel={field.fieldType}
		>
			{isContextField ? (
				<>
					<Select
						allowClear
						showSearch
						disabled={!canEdit}
						options={options}
						value={selectedGroupRef}
						placeholder="Kontext-Gruppe wählen (kein Component-Stack)"
						optionFilterProp="label"
						onChange={(contextGroupRef) => {
							if (!contextGroupRef) {
								onChange("");
								return;
							}
							const group = allGroups.find((entry) => entry.id === contextGroupRef);
							onChange(
								buildContextValueReference(
									contextGroupRef,
									field.dataStructure.itemName,
									group ? groupDisplayName(group) : contextGroupRef
								)
							);
						}}
						style={{ width: "100%" }}
					/>
					<div className="schema-editor-value-ref__hint" style={{ marginTop: 4, opacity: 0.75 }}>
						Nur der referenzierte Wert aus der Gruppe wird übernommen — nicht basedOn / keine
						Stack-Ebenen.
					</div>
				</>
			) : null}
			{selectedGroupRef || isValueReference(value) ? (
				<div className="schema-editor-value-ref__resolved" style={{ marginTop: 4, opacity: 0.75 }}>
					Aufgelöst: {String(resolved)}
				</div>
			) : null}
		</SchemaEditorFieldShell>
	);
};

export default observer(SchemaEditorValueRefField);
