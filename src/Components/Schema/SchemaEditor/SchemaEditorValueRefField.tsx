import React from "react";
import { Select } from "antd";
import { observer } from "mobx-react";
import { rootStore } from "../../../Stores/Root.Store";
import { assetDisplayName } from "../../../lib/connectionCandidateFilter";
import {
	buildValueReference,
	isValueReference,
	resolveValueReference,
} from "../../../lib/valueReferenceResolve";
import SchemaEditorFieldShell, { SchemaEditorFieldState } from "./SchemaEditorFieldShell";
import { ISchemaFieldModel } from "../../../Stores/Models/SchemaField.Model";

interface SchemaEditorValueRefFieldProps {
	field: ISchemaFieldModel;
	value: unknown;
	canEdit: boolean;
	onChange: (next: unknown) => void;
	mstPath?: string;
	schemaPath?: string;
}

const SchemaEditorValueRefField: React.FC<SchemaEditorValueRefFieldProps> = ({
	field,
	value,
	canEdit,
	onChange,
	mstPath,
	schemaPath,
}) => {
	const allAssets = rootStore.assets.assets.slice();
	const options = allAssets.map((asset) => ({
		value: asset.id,
		label: assetDisplayName(asset),
	}));

	const selectedRef = isValueReference(value) ? value.componentRef : undefined;
	const resolved = resolveValueReference(value, allAssets);
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
			<Select
				allowClear
				showSearch
				disabled={!canEdit}
				options={options}
				value={selectedRef}
				placeholder="Component-Referenz wählen"
				optionFilterProp="label"
				onChange={(componentRef) => {
					if (!componentRef) {
						onChange("");
						return;
					}
					const asset = allAssets.find((entry) => entry.id === componentRef);
					onChange(
						buildValueReference(
							componentRef,
							field.fieldType === "valueRef" ? field.dataStructure.itemName : undefined,
							asset ? assetDisplayName(asset) : componentRef
						)
					);
				}}
				style={{ width: "100%" }}
			/>
			{selectedRef ? (
				<div className="schema-editor-value-ref__resolved" style={{ marginTop: 4, opacity: 0.75 }}>
					Aufgelöst: {String(resolved)}
				</div>
			) : null}
		</SchemaEditorFieldShell>
	);
};

export default observer(SchemaEditorValueRefField);
