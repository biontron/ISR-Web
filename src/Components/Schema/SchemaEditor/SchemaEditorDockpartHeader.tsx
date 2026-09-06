import React from "react";
import { observer } from "mobx-react";
import { Input, Select } from "antd";
import CardCollapse from "../../../Apps/AssetManagement/Components/CardCollapse.Component";
import { IDock, isDockpartNode } from "../../../Stores/Models/Dock.Model";
import { IElement } from "../../../Stores/Models/Element.Model";
import { IAsset } from "../../../Stores/Models/Asset.Model";
import { useLangtext } from "../../../lib/common";
import { interpolateTitleTemplate } from "../../../lib/titleTemplate";
import { resolveAllowedLowerTypes } from "../../../lib/dockpartBasedOn";
import { IConnectSchemaModel } from "../../../Stores/Models/ConnectSchema.Model";

interface SchemaEditorDockpartHeaderProps {
	dockpart: unknown;
	dock: IDock | undefined;
	elementData: IElement;
	canEdit: boolean;
	schemas: IConnectSchemaModel[];
}

function commit(elementData: IElement, mutate: () => void) {
	const asset = elementData as IAsset;
	asset.beginEdit?.();
	mutate();
	asset.markTouched?.();
}

const SchemaEditorDockpartHeader: React.FC<SchemaEditorDockpartHeaderProps> = ({
	dockpart,
	dock,
	elementData,
	canEdit,
	schemas,
}) => {
	const langtext = useLangtext();
	if (!isDockpartNode(dockpart)) {
		return null;
	}

	const title = interpolateTitleTemplate(
		"#{id} {type} / {version} - {label}",
		dockpart,
		dockpart.type || langtext("schema_editor.dockpart_header"),
		{ root: elementData }
	);

	const allowed = resolveAllowedLowerTypes(dockpart.type || dockpart.protocol, schemas);
	const basedOnOptions = (dock?.dockparts ?? [])
		.filter((part) => String(part.id) !== String(dockpart.id))
		.filter((part) => {
			if (allowed.length === 0) {
				return true;
			}
			const type = String(part.type || part.protocol || "").toUpperCase();
			return allowed.includes(type === "IPV4" || type === "IPV6" ? "IP" : type);
		})
		.map((part) => ({
			value: String(part.id),
			label: `#${part.id} ${part.type || part.protocol || ""}${
				part.label ? ` – ${part.label}` : ""
			}`.trim(),
		}));

	return (
		<CardCollapse title={title} defaultCollapsed depth={1}>
			{() => (
				<div className="schema-editor-field-list">
					<div className={`schema-editor-field Field ${canEdit ? "Edit" : "View"}`}>
						<label className="schema-editor-field__label">
							{langtext("schema_editor.dockpart_type")}
						</label>
						<div className="schema-editor-field__control">
							<Input value={dockpart.type} disabled />
						</div>
					</div>
					<div className={`schema-editor-field Field ${canEdit ? "Edit" : "View"}`}>
						<label className="schema-editor-field__label">
							{langtext("schema_editor.dockpart_version")}
						</label>
						<div className="schema-editor-field__control">
							<Input
								value={dockpart.version}
								disabled={!canEdit}
								onChange={(event) =>
									commit(elementData, () => {
										dockpart.version = event.target.value;
									})
								}
							/>
						</div>
					</div>
					<div className={`schema-editor-field Field ${canEdit ? "Edit" : "View"}`}>
						<label className="schema-editor-field__label">
							{langtext("schema_editor.dockpart_label")}
						</label>
						<div className="schema-editor-field__control">
							<Input
								value={dockpart.label}
								disabled={!canEdit}
								onChange={(event) =>
									commit(elementData, () => {
										dockpart.label = event.target.value;
									})
								}
							/>
						</div>
					</div>
					<div className={`schema-editor-field Field ${canEdit ? "Edit" : "View"}`}>
						<label className="schema-editor-field__label">
							{langtext("schema_editor.dockpart_notes")}
						</label>
						<div className="schema-editor-field__control">
							<Input.TextArea
								value={dockpart.notes}
								disabled={!canEdit}
								autoSize={{ minRows: 2, maxRows: 6 }}
								onChange={(event) =>
									commit(elementData, () => {
										dockpart.notes = event.target.value;
									})
								}
							/>
						</div>
					</div>
					<div className={`schema-editor-field Field ${canEdit ? "Edit" : "View"}`}>
						<label className="schema-editor-field__label">
							{langtext("schema_editor.based_on")}
						</label>
						<div className="schema-editor-field__control">
							<Select
								mode="multiple"
								allowClear
								style={{ width: "100%" }}
								disabled={!canEdit}
								placeholder={langtext("schema_editor.based_on_placeholder")}
								value={dockpart.basedOn.map((entry) => String(entry.dockpartId))}
								options={basedOnOptions}
								onChange={(ids) =>
									commit(elementData, () => {
										dockpart.basedOn.replace(
											(ids as string[]).map((id) => ({ dockpartId: id }))
										);
									})
								}
							/>
						</div>
					</div>
					<div className={`schema-editor-field Field ${canEdit ? "Edit" : "View"}`}>
						<label className="schema-editor-field__label">
							{langtext("schema_editor.dockpart_state")}
						</label>
						<div className="schema-editor-field__control">
							<Input
								value={dockpart.state.value}
								disabled={!canEdit}
								onChange={(event) =>
									commit(elementData, () => {
										dockpart.state.value = event.target.value;
									})
								}
							/>
						</div>
					</div>
				</div>
			)}
		</CardCollapse>
	);
};

export default observer(SchemaEditorDockpartHeader);
