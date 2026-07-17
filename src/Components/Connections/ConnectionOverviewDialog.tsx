/*
	========================================================================
	LICENSE AGREEMENT — siehe Projekt-Header
	========================================================================
*/

import React, { useState } from "react";
import { Button, Modal, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table/interface";
import { observer } from "mobx-react";
import { rootStore } from "../../Stores/Root.Store";
import {
	getConnectionDisplayName,
	IConnection,
} from "../../Stores/Models/Connection.Model";
import { IAsset } from "../../Stores/Models/Asset.Model";
import { useLangtext } from "../../lib/common";
import {
	connectionTouchesAsset,
	formatAssetDisplayName,
	formatConnectionSideSummary,
	resolveConnectionFromAssetId,
	resolveConnectionToAssetId,
} from "../../lib/connectionEndpointRef";
import { isTouchedStatus } from "../../lib/elementStaging";
import { activityStatusOverviewUi } from "../../lib/activityStatusOverviewUi";
import ConnectionEditDialog from "./ConnectionEditDialog";

interface ConnectionOverviewDialogProps {
	visible: boolean;
	currentAsset?: IAsset | null;
	onClose: () => void;
}

interface ConnectionOverviewRow {
	key: string;
	connection: IConnection;
	name: string;
	fromSummary: string;
	toSummary: string;
	direction: string;
	linkpartCount: number;
	status: string;
	touchesCurrentAsset: boolean;
	fromAssetId?: string;
	toAssetId?: string;
}

const ConnectionOverviewDialog: React.FC<ConnectionOverviewDialogProps> = ({
	visible,
	currentAsset,
	onClose,
}) => {
	const langtext = useLangtext();
	const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);

	const assets = rootStore.assets.assets.slice();
	const allConnections = rootStore.connections.connections.slice();

	const rows: ConnectionOverviewRow[] = allConnections.map((connection) => {
		const link = connection.links[0];
		const linkpartCount = connection.links.reduce(
			(total, entry) => total + entry.linkparts.length,
			0
		);
		return {
			key: connection.id,
			connection,
			name: getConnectionDisplayName(connection),
			fromSummary: formatConnectionSideSummary(connection, assets, "from"),
			toSummary: formatConnectionSideSummary(connection, assets, "to"),
			direction: link?.direction?.trim() || "DUAL",
			linkpartCount,
			status: connection.status,
			touchesCurrentAsset: currentAsset
				? connectionTouchesAsset(connection, currentAsset, assets)
				: false,
			fromAssetId: resolveConnectionFromAssetId(connection, assets),
			toAssetId: resolveConnectionToAssetId(connection, assets),
		};
	});

	const handleOpenAsset = (assetId: string | undefined) => {
		if (!assetId) {
			return;
		}
		rootStore.ui.setActiveElementById(assetId);
		onClose();
	};

	const pendingConnectionCount = allConnections.filter((connection) =>
		isTouchedStatus(connection.status)
	).length;

	const columns: ColumnsType<ConnectionOverviewRow> = [
		{
			title: langtext("general.connection_overview_col_name"),
			dataIndex: "name",
			key: "name",
			render: (_value, row) => (
				<Space direction="vertical" size={0}>
					<span>{row.name}</span>
					<span style={{ fontSize: 12, opacity: 0.65 }}>{row.connection.id}</span>
				</Space>
			),
		},
		{
			title: langtext("general.connection_overview_col_from"),
			dataIndex: "fromSummary",
			key: "fromSummary",
			render: (value, row) => (
				<Button type="link" size="small" onClick={() => handleOpenAsset(row.fromAssetId)}>
					{value}
				</Button>
			),
		},
		{
			title: langtext("general.connection_overview_col_to"),
			dataIndex: "toSummary",
			key: "toSummary",
			render: (value, row) => (
				<Button type="link" size="small" onClick={() => handleOpenAsset(row.toAssetId)}>
					{value}
				</Button>
			),
		},
		{
			title: langtext("general.connection_overview_col_direction"),
			dataIndex: "direction",
			key: "direction",
			width: 110,
		},
		{
			title: langtext("general.connection_overview_col_linkparts"),
			dataIndex: "linkpartCount",
			key: "linkpartCount",
			width: 90,
		},
		{
			title: langtext("general.connection_overview_col_status"),
			dataIndex: "status",
			key: "status",
			width: 110,
			render: (status: string) =>
				status === "untouched" ? null : <Tag>{status}</Tag>,
		},
		{
			title: "",
			key: "actions",
			width: 120,
			render: (_value, row) => (
				<Button type="link" onClick={() => setEditingConnectionId(row.connection.id)}>
					{langtext("general.connection_edit")}
				</Button>
			),
		},
	];

	const currentAssetLabel = currentAsset
		? formatAssetDisplayName(currentAsset)
		: undefined;

	return (
		<>
			<Modal
				title={langtext("general.connection_overview_dialog_title")}
				open={visible}
				onCancel={onClose}
				width={960}
				footer={[
					pendingConnectionCount > 0 ? (
						<Button
							key="activity"
							onClick={() => activityStatusOverviewUi.show("write")}
						>
							{langtext("general.connection_overview_open_activity_status", {
								count: String(pendingConnectionCount),
							})}
						</Button>
					) : null,
					<Button key="close" onClick={onClose}>
						{langtext("general.activity_status_close")}
					</Button>,
				]}
			>
				{currentAsset && (
					<p style={{ marginBottom: 12 }}>
						{langtext("general.connection_overview_current_asset")}:{" "}
						<strong>{currentAssetLabel}</strong>
					</p>
				)}
				<Table
					size="small"
					pagination={{ pageSize: 10, hideOnSinglePage: true }}
					dataSource={rows}
					columns={columns}
					locale={{ emptyText: langtext("general.connection_empty") }}
					rowClassName={(row) =>
						row.touchesCurrentAsset ? "connection-overview-row--current" : ""
					}
				/>
				{currentAsset && rows.length > 0 && !rows.some((row) => row.touchesCurrentAsset) && (
					<Tag color="warning" style={{ marginTop: 12 }}>
						{langtext("general.connection_overview_no_match_for_asset")}
					</Tag>
				)}
			</Modal>
			<ConnectionEditDialog
				connectionId={editingConnectionId}
				onClose={() => setEditingConnectionId(null)}
			/>
		</>
	);
};

export default observer(ConnectionOverviewDialog);
