/*
# SPDX-License-Identifier: GPL-2.0*/

import React from "react";
import { Button, Space, Tooltip, message } from "antd";
import { observer } from "mobx-react";
import { rootStore } from "../../Stores/Root.Store";
import { useLangtext } from "../../lib/common";
import { IElement } from "../../Stores/Models/Element.Model";
import {
	canDiscardElementStatus,
	canSaveElementStatus,
	finalizeLocalEdit,
} from "../../lib/activityStatusActions";
import { isSchemaUserEditable } from "../../lib/schemaDomainPolicy";
import { SchemaStoreType } from "../../lib/schemaDomain";

interface SchemaDetailsActionsProps {
	schema: IElement;
	/** Kompakte Darstellung in der Tab-Leiste (Schema Manager). */
	compact?: boolean;
}

const SchemaDetailsActions: React.FC<SchemaDetailsActionsProps> = observer(({ schema, compact = false }) => {
	const langtext = useLangtext();
	const { isReadOnly } = rootStore.ui;

	if (isReadOnly) {
		return null;
	}

	const schemaRecord = schema as IElement & { storeType?: SchemaStoreType };
	if (
		schemaRecord.storeType &&
		!isSchemaUserEditable({ id: schema.id, storeType: schemaRecord.storeType }, isReadOnly)
	) {
		return null;
	}

	const canSave = canSaveElementStatus(schema.status);
	const canDiscard = canDiscardElementStatus(schema.status);
	const showEditStart =
		schema.status !== "edit" &&
		schema.status !== "changed" &&
		schema.status !== "new" &&
		schema.status !== "deleted";

	const handleSave = () => {
		finalizeLocalEdit(schema);
		message.success(langtext("general.element_save"));
	};

	const handleDiscard = () => {
		if (schema.status === "edit" || schema.status === "changed") {
			schema.rollbackEdit();
		}
	};

	const handleSwitchToEditMode = () => {
		schema.beginEdit();
	};

	if (!canSave && !canDiscard && !showEditStart) {
		return null;
	}

	return (
		<div
			className={compact ? "schema-details-actions schema-details-actions--compact" : "schema-details-actions"}
			style={
				compact
					? undefined
					: {
						marginBottom: 12,
						padding: "12px 16px",
						border: "1px solid #f0f0f0",
						borderRadius: 4,
						background: "#fafafa",
					}
			}
		>
			<Space wrap>
				{canSave && (
					<Button type="primary" onClick={handleSave}>
						{langtext("general.element_save")}
					</Button>
				)}
				{canDiscard && (
					<Button onClick={handleDiscard}>
						{langtext("general.element_discard")}
					</Button>
				)}
				{showEditStart && (
					<Tooltip title={langtext("general.element_edit_tooltip")}>
						<Button type="default" onClick={handleSwitchToEditMode}>
							{langtext("general.element_edit_start")}
						</Button>
					</Tooltip>
				)}
			</Space>
		</div>
	);
});

export default SchemaDetailsActions;
