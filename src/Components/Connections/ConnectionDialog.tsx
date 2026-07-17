import React, { useEffect, useMemo, useState } from "react";
import { Button, Empty, Modal, Tabs, Tag, Tooltip, message } from "antd";
import { CodeOutlined } from "@ant-design/icons";
import { observer } from "mobx-react";
import SchemaEditor from "../Schema/SchemaEditor/SchemaEditor.Component";
import JsonInspectDialog from "../ChangeMode/JsonInspectDialog";
import AssetConnectionManagerPanel from "./AssetConnectionManagerPanel";
import { rootStore } from "../../Stores/Root.Store";
import { getConnectionDisplayName, IConnection } from "../../Stores/Models/Connection.Model";
import { useLangtext } from "../../lib/common";
import { buildElementStatusClass } from "../../lib/elementStatusStyle";
import { hasElementConnectionValidationErrors } from "../../lib/elementValidationChecks";
import { buildConnectionJsonInspectTarget } from "../../lib/jsonInspectResolve";
import {
	resolveConnectionFromAssetId,
	resolveConnectionToAssetId,
} from "../../lib/connectionEndpointRef";
import { connectionUriSidesForDirection, resolveConnectionDirection } from "../../lib/connectionDirection";
import { connectionModeLabel, resolveConnectionMode } from "../../lib/connectionMode";
import {
	canSaveElementStatus,
	discardElement,
	saveElement,
} from "../../lib/activityStatusActions";
import { activityStatusOverviewUi } from "../../lib/activityStatusOverviewUi";

interface ConnectionDialogProps {
	connectionId: string | null;
	onClose: () => void;
}

function canEditConnection(connection: IConnection | undefined): boolean {
	if (!connection || rootStore.ui.isReadOnly) {
		return false;
	}
	return ["new", "edit", "changed", "invalid"].includes(connection.status);
}

const ConnectionLinksPanel: React.FC<{ connection: IConnection }> = observer(({ connection }) => {
	const langtext = useLangtext();
	const primaryLink = connection.links[0];
	const direction = resolveConnectionDirection(primaryLink?.direction);
	const sides = connectionUriSidesForDirection(direction);

	return (
		<div className="connection-links-panel">
			{sides.from || sides.to ? (
				<ul className="connection-links-panel__list">
					{sides.from ? (
						<li>{langtext("general.connection_dialog_uri_from")} — {langtext("general.connection_dialog_uri_pending")}</li>
					) : null}
					{sides.to ? (
						<li>{langtext("general.connection_dialog_uri_to")} — {langtext("general.connection_dialog_uri_pending")}</li>
					) : null}
				</ul>
			) : (
				<Empty description={langtext("general.connection_dialog_uri_logical")} />
			)}
		</div>
	);
});

const ConnectionDialog: React.FC<ConnectionDialogProps> = ({ connectionId, onClose }) => {
	const langtext = useLangtext();
	const [jsonInspectOpen, setJsonInspectOpen] = useState(false);
	const [activeTab, setActiveTab] = useState("links");
	const [saving, setSaving] = useState(false);
	const connection = connectionId
		? rootStore.connections.connections.find((item) => item.id === connectionId)
		: undefined;
	const visible = !!connection;
	const canEdit = canEditConnection(connection);
	const assets = rootStore.assets.assets.slice();
	const fromAssetId = connection ? resolveConnectionFromAssetId(connection, assets) : null;
	const toAssetId = connection ? resolveConnectionToAssetId(connection, assets) : null;
	const hasErrors =
		!!connection && canEdit && hasElementConnectionValidationErrors(rootStore, connection);
	const bodyClass = buildElementStatusClass(
		"connection-dialog__body",
		hasErrors ? "invalid" : connection?.status
	);
	const jsonInspectTarget = useMemo(
		() => (connection ? buildConnectionJsonInspectTarget(connection) : null),
		[connection]
	);
	const dialogTitle = connection
		? getConnectionDisplayName(connection)
		: langtext("general.connection_dialog_title");
	const modeLabel = connection ? connectionModeLabel(resolveConnectionMode(connection)) : null;

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

	return (
		<>
			<Modal
				title={
					<div className="connection-dialog__title-row">
						<div className="connection-dialog__title-text">
							<div className="connection-dialog__title-main">
								{langtext("general.connection_dialog_title")}
							</div>
							<div className="connection-dialog__title-sub">
								{dialogTitle}
								{modeLabel ? (
									<Tag style={{ marginLeft: 8 }} color="blue">
										{modeLabel}
									</Tag>
								) : null}
								{connection && connection.links.length > 1 ? (
									<Tag style={{ marginLeft: 4 }}>{connection.links.length} Links</Tag>
								) : null}
							</div>
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
				onCancel={onClose}
				width={980}
				destroyOnClose
				className="connection-dialog"
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
						<Tabs
							activeKey={activeTab}
							onChange={setActiveTab}
							items={[
								{
									key: "links",
									label: langtext("general.connection_dialog_tab_links"),
									children: <ConnectionLinksPanel connection={connection} />,
								},
								{
									key: "edit",
									label: langtext("general.connection_dialog_tab_edit"),
									children: (
										<SchemaEditor
											schemaName="CONNECTION"
											pathPrefix=""
											elementData={connection}
											canEdit={canEdit}
										/>
									),
								},
								{
									key: "from",
									label: langtext("general.connection_dialog_tab_from"),
									children: <AssetConnectionManagerPanel assetId={fromAssetId} />,
								},
								{
									key: "to",
									label: langtext("general.connection_dialog_tab_to"),
									children: <AssetConnectionManagerPanel assetId={toAssetId} />,
								},
							]}
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

export default observer(ConnectionDialog);
