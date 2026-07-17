/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { useEffect, useMemo, useState } from "react";
import { Button, Modal, Tooltip, message } from "antd";
import { CodeOutlined } from "@ant-design/icons";
import { observer } from "mobx-react";
import SchemaEditor from "../Schema/SchemaEditor/SchemaEditor.Component";
import JsonInspectDialog from "../ChangeMode/JsonInspectDialog";
import { rootStore } from "../../Stores/Root.Store";
import { getConnectionDisplayName, IConnection } from "../../Stores/Models/Connection.Model";
import { useLangtext } from "../../lib/common";
import { buildElementStatusClass } from "../../lib/elementStatusStyle";
import { hasElementConnectionValidationErrors } from "../../lib/elementValidationChecks";
import { buildConnectionJsonInspectTarget } from "../../lib/jsonInspectResolve";
import {
	canSaveElementStatus,
	discardElement,
	saveElement,
} from "../../lib/activityStatusActions";
import { activityStatusOverviewUi } from "../../lib/activityStatusOverviewUi";

interface ConnectionEditDialogProps {
	connectionId: string | null;
	onClose: () => void;
}

function canEditConnection(connection: IConnection | undefined): boolean {
	if (!connection || rootStore.ui.isReadOnly) {
		return false;
	}
	return ["new", "edit", "changed", "invalid"].includes(connection.status);
}

const ConnectionEditDialog: React.FC<ConnectionEditDialogProps> = ({
	connectionId,
	onClose,
}) => {
	const langtext = useLangtext();
	const [jsonInspectOpen, setJsonInspectOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const connection = connectionId
		? rootStore.connections.connections.find((item) => item.id === connectionId)
		: undefined;
	const visible = !!connection;
	const canEdit = canEditConnection(connection);
	const hasErrors =
		!!connection && canEdit && hasElementConnectionValidationErrors(rootStore, connection);
	const bodyClass = buildElementStatusClass(
		"connection-edit-dialog__body",
		hasErrors ? "invalid" : connection?.status
	);
	const jsonInspectTarget = useMemo(
		() => (connection ? buildConnectionJsonInspectTarget(connection) : null),
		[connection]
	);
	const dialogTitle = connection
		? getConnectionDisplayName(connection)
		: langtext("general.connection_edit");

	useEffect(() => {
		if (!visible || !connection || rootStore.ui.isReadOnly) {
			return;
		}
		if (connection.status === "untouched") {
			connection.beginEdit();
		}
	}, [visible, connection]);

	const handleStore = async () => {
		if (!connection) {
			return;
		}
		setSaving(true);
		try {
			const { saved, failed } = await saveElement(rootStore, connection);
			if (failed.length > 0) {
				message.error(
					langtext("general.activity_status_save_summary", {
						saved: String(saved),
						failed: String(failed.length),
					})
				);
				activityStatusOverviewUi.show("write");
				return;
			}
			if (saved > 0) {
				onClose();
			}
		} finally {
			setSaving(false);
		}
	};

	const handleReset = () => {
		if (connection) {
			discardElement(rootStore, connection);
		}
	};

	const handleClose = () => {
		onClose();
	};

	return (
		<>
			<Modal
				title={
					<div className="connection-edit-dialog__title-row">
						<div className="connection-edit-dialog__title-text">
							<div className="connection-edit-dialog__title-main">
								{langtext("general.connection_edit")}
							</div>
							<div className="connection-edit-dialog__title-sub">{dialogTitle}</div>
						</div>
						{connection ? (
							<Tooltip title={langtext("general.json_inspect")}>
								<Button
									type="text"
									icon={<CodeOutlined />}
									aria-label={langtext("general.json_inspect")}
									onClick={() => setJsonInspectOpen(true)}
								/>
							</Tooltip>
						) : null}
					</div>
				}
				open={visible}
				onCancel={handleClose}
				width={960}
				destroyOnClose
				className="connection-edit-dialog"
				footer={
					canEdit ? (
						<>
							<Button onClick={handleReset} disabled={saving}>
								{langtext("general.edit_reset")}
							</Button>
							<Button
								type="primary"
								onClick={handleStore}
								loading={saving}
								disabled={!canSaveElementStatus(connection?.status)}
							>
								{langtext("general.edit_store")}
							</Button>
						</>
					) : null
				}
			>
				{connection ? (
					<div className={bodyClass}>
						<SchemaEditor
							schemaName="CONNECTION"
							pathPrefix=""
							elementData={connection}
							canEdit={canEdit}
						/>
					</div>
				) : null}
			</Modal>

			<JsonInspectDialog
				open={jsonInspectOpen}
				target={jsonInspectTarget}
				onClose={() => setJsonInspectOpen(false)}
			/>
		</>
	);
};

export default observer(ConnectionEditDialog);
