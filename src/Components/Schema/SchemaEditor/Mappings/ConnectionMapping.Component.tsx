/*
    ========================================================================
    ...
    ========================================================================
*/
// File: src/Components/Schema/SchemaEditor/Mappings/ConnectionMapping.Component.tsx

import React, { useState, Fragment } from "react";
import { Alert, List, Button, Space } from "antd";
import { PlusOutlined, UnorderedListOutlined, LinkOutlined } from "@ant-design/icons";
import { observer } from "mobx-react";
import { rootStore } from "../../../../Stores/Root.Store";
import {
	getConnectionDisplayName,
	IConnection,
} from "../../../../Stores/Models/Connection.Model";
import { IAsset } from "../../../../Stores/Models/Asset.Model";
import { useLangtext } from "../../../../lib/common";
import ConnectionSelectionDialog from "../../../Connections/ConnectionSelectionDialog";
import LogicalConnectionDialog from "../../../Connections/LogicalConnectionDialog";
import ConnectionEditDialog from "../../../Connections/ConnectionEditDialog";
import ConnectionOverviewDialog from "../../../Connections/ConnectionOverviewDialog";
import { canOpenConnectionSelectionDialog } from "../../../../lib/connectionDockpartPairing";
import { filterConnectionsForAssetEndpoints } from "../../../../Stores/Connection.Store";
import { formatConnectionSideSummary } from "../../../../lib/connectionEndpointRef";
import { resolveConnectionMode, connectionModeLabel } from "../../../../lib/connectionMode";

interface ConnectionMappingProps {
	element: IAsset;
}

const ConnectionMapping: React.FC<ConnectionMappingProps> = observer(({ element }) => {
	const langtext = useLangtext();
	const [selectionVisible, setSelectionVisible] = useState(false);
	const [logicalVisible, setLogicalVisible] = useState(false);
	const [overviewVisible, setOverviewVisible] = useState(false);
	const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);

	const allAssets = rootStore.assets.assets.slice();
	const allConnections = rootStore.connections.connections.slice();
	const connections = filterConnectionsForAssetEndpoints(
		allConnections,
		element,
		allAssets
	);

	const openAddDialog = () => {
		if (!canAdd) {
			return;
		}
		setSelectionVisible(true);
	};

	const handleDelete = (connectionId: string) => {
		rootStore.connections.remove(connectionId);
	};

	const handleOpenConnection = (connection: IConnection) => {
		setEditingConnectionId(connection.id);
	};

	const canAdd = canOpenConnectionSelectionDialog(allAssets, element);

	const hiddenConnectionCount = allConnections.length - connections.length;

	return (
		<Fragment>
			<div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
				<Space>
					<Button icon={<UnorderedListOutlined />} onClick={() => setOverviewVisible(true)}>
						{langtext("general.connection_overview_open")}
					</Button>
					<Button
						icon={<LinkOutlined />}
						onClick={() => setLogicalVisible(true)}
						disabled={allAssets.length < 2}
					>
						{langtext("general.connection_logical_add")}
					</Button>
					<Button
						type="primary"
						icon={<PlusOutlined />}
						onClick={openAddDialog}
						disabled={!canAdd}
					>
						{langtext("general.connection_add")}
					</Button>
				</Space>
			</div>

			{connections.length === 0 && allConnections.length > 0 && (
				<Alert
					type="info"
					showIcon
					style={{ marginBottom: 16 }}
					message={langtext("general.connection_overview_hidden_hint", {
						count: String(allConnections.length),
					})}
					action={
						<Button size="small" onClick={() => setOverviewVisible(true)}>
							{langtext("general.connection_overview_open")}
						</Button>
					}
				/>
			)}
			{hiddenConnectionCount > 0 && connections.length > 0 && (
				<Alert
					type="info"
					showIcon
					style={{ marginBottom: 16 }}
					message={langtext("general.connection_overview_partial_hint", {
						shown: String(connections.length),
						total: String(allConnections.length),
					})}
				/>
			)}

			<List
				dataSource={connections}
				locale={{ emptyText: langtext("general.connection_empty") }}
				renderItem={(item: IConnection) => {
					const label = getConnectionDisplayName(item);
					const mode = connectionModeLabel(resolveConnectionMode(item));
					const endpoints = `${formatConnectionSideSummary(item, allAssets, "from")} ↔ ${formatConnectionSideSummary(item, allAssets, "to")}`;
					const linkCount = item.links.length;
					return (
						<List.Item
							actions={[
								<Button key="open" type="link" onClick={() => handleOpenConnection(item)}>
									{langtext("general.connection_edit")}
								</Button>,
								<Button key="delete" danger onClick={() => handleDelete(item.id)}>
									{langtext("general.delete")}
								</Button>,
							]}
						>
							<div>
								<div>{label}</div>
								<div style={{ fontSize: 12, opacity: 0.75 }}>
									{mode}
									{linkCount > 1 ? ` · ${linkCount} Links` : ""} — {endpoints}
								</div>
							</div>
						</List.Item>
					);
				}}
			/>
			<ConnectionSelectionDialog
				visible={selectionVisible}
				currentAsset={element}
				onCancel={() => setSelectionVisible(false)}
				onCreated={(connectionId) => setEditingConnectionId(connectionId)}
			/>
			<LogicalConnectionDialog
				visible={logicalVisible}
				fromAsset={element}
				onCancel={() => setLogicalVisible(false)}
				onCreated={(connectionId) => setEditingConnectionId(connectionId)}
			/>
			<ConnectionEditDialog
				connectionId={editingConnectionId}
				onClose={() => setEditingConnectionId(null)}
			/>
			<ConnectionOverviewDialog
				visible={overviewVisible}
				currentAsset={element}
				onClose={() => setOverviewVisible(false)}
			/>
		</Fragment>
	);
});

export default ConnectionMapping;
