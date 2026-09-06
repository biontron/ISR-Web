import React from "react";
import { observer } from "mobx-react";
import { Select } from "antd";
import { IDock, IDockpart, isDockpartNode } from "../../../Stores/Models/Dock.Model";
import { IElement } from "../../../Stores/Models/Element.Model";
import { IAsset } from "../../../Stores/Models/Asset.Model";
import { useLangtext } from "../../../lib/common";
import { resolveAllowedLowerTypes } from "../../../lib/dockpartBasedOn";
import { IConnectSchemaModel } from "../../../Stores/Models/ConnectSchema.Model";

interface SchemaEditorDockpartBasedOnProps {
	dockpart: unknown;
	dock: IDock | undefined;
	elementData: IElement;
	canEdit: boolean;
	schemas: IConnectSchemaModel[];
}

const SchemaEditorDockpartBasedOn: React.FC<SchemaEditorDockpartBasedOnProps> = ({
	dockpart,
	dock,
	elementData,
	canEdit,
	schemas,
}) => {
	const langtext = useLangtext();
	if (!isDockpartNode(dockpart) || !dock) {
		return null;
	}

	const allowed = resolveAllowedLowerTypes(dockpart.type || dockpart.protocol, schemas);
	const options = dock.dockparts
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

	const value = dockpart.basedOn.map((entry) => String(entry.dockpartId));

	const apply = (ids: string[]) => {
		const asset = elementData as IAsset;
		asset.beginEdit?.();
		dockpart.basedOn.replace(ids.map((id) => ({ dockpartId: id })));
		asset.markTouched?.();
	};

	return (
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
					value={value}
					options={options}
					onChange={(ids) => apply(ids as string[])}
				/>
			</div>
		</div>
	);
};

export default observer(SchemaEditorDockpartBasedOn);

export function findDockForEntryPath(elementData: IElement, entryPath: string): IDock | undefined {
	const match = entryPath.match(/^docks\[(\d+)\]\.dockparts\[\d+\]$/);
	if (!match) {
		return undefined;
	}
	const asset = elementData as IAsset;
	return asset.docks?.[parseInt(match[1], 10)];
}
