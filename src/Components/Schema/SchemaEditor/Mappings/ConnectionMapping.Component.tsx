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
import { IGroup } from "../../../../Stores/Models/Group.Model";
import { useLangtext } from "../../../../lib/common";
import ConnectionSelectionDialog from "../../../Connections/ConnectionSelectionDialog";
import LogicalConnectionDialog from "../../../Connections/LogicalConnectionDialog";
import ContextConnectionDialog from "../../../Connections/ContextConnectionDialog";
import BridgeConnectionDialog from "../../../Connections/BridgeConnectionDialog";
import ConnectionEditDialog from "../../../Connections/ConnectionEditDialog";
import ConnectionOverviewDialog from "../../../Connections/ConnectionOverviewDialog";
import { canOpenConnectionSelectionDialog } from "../../../../lib/connectionDockpartPairing";
import { filterConnectionsForElement } from "../../../../Stores/Connection.Store";
import { formatConnectionSideSummary } from "../../../../lib/connectionEndpointRef";
import { resolveConnectionMode, connectionModeLabel } from "../../../../lib/connectionMode";

interface ConnectionMappingProps {
	element: IAsset | IGroup;
	contextPrefill?: { contextId?: string; dockpartId?: string };
}

const ConnectionMapping: React.FC<ConnectionMappingProps> = observer(({ element, contextPrefill }) => {
	const langtext = useLangtext();
	const [selectionVisible, setSelectionVisible] = useState(false);
	const [logicalVisible, setLogicalVisible] = useState(false);
	const [contextVisible, setContextVisible] = useState(!!contextPrefill?.contextId);
	const [bridgeVisible, setBridgeVisible] = useState(false);
	const [overviewVisible, setOverviewVisible] = useState(false);
	const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);

	const isAsset = element.class === "Asset";
	const asset = isAsset ? (element as IAsset) : null;
	const allAssets = rootStore.assets.assets.slice();
	const allGroups = rootStore.groups.groups.slice();
	const allConnections = rootStore.connections.connections.slice();
	const connections = filterConnectionsForElement(allConnections, element, allAssets);

	const canAddLink = !!asset && canOpenConnectionSelectionDialog(allAssets, asset);
	const hiddenConnectionCount = allConnections.length - connections.length;
	const closeContextDialog = () => {
		setContextVisible(false);
		rootStore.ui.clearPendingContextBind();
	};

	return (
		<Fragment>
			<div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
				<Space wrap>
					<Button icon={<UnorderedListOutlined />} onClick={() => setOverviewVisible(true)}>
						{langtext("general.connection_overview_open")}
					</Button>
					<Button
						icon={<LinkOutlined />}
						onClick={() => setLogicalVisible(true)}
						disabled={allAssets.length + allGroups.length < 2}
					>
						{langtext("general.connection_logical_add")}
					</Button>
					{asset ? (
						<Button onClick={() => setBridgeVisible(true)}>
							{langtext("general.connection_bridge_add")}
						</Button>
					) : null}
					{asset ? (
						<Button onClick={() => setContextVisible(true)}>
							{langtext("general.connection_context_add")}
						</Button>
					) : null}
					{asset ? (
						<Button
							type="primary"
							icon={<PlusOutlined />}
							onClick={() => setSelectionVisible(true)}
							disabled={!canAddLink}
						>
							{langtext("general.connection_add")}
						</Button>
					) : null}
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
					const endpoints = `${formatConnectionSideSummary(item, allAssets, "from", allGroups)} ↔ ${formatConnectionSideSummary(item, allAssets, "to", allGroups)}`;
					const linkCount = item.links.length;
					return (
						<List.Item
							actions={[
								<Button key="open" type="link" onClick={() => setEditingConnectionId(item.id)}>
									{langtext("general.connection_edit")}
								</Button>,
								<Button key="delete" danger onClick={() => rootStore.connections.remove(item.id)}>
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
			{asset ? (
				<ConnectionSelectionDialog
					visible={selectionVisible}
					currentAsset={asset}
					onCancel={() => setSelectionVisible(false)}
					onCreated={(connectionId) => setEditingConnectionId(connectionId)}
				/>
			) : null}
			<LogicalConnectionDialog
				visible={logicalVisible}
				fromElement={element}
				onCancel={() => setLogicalVisible(false)}
				onCreated={(connectionId) => setEditingConnectionId(connectionId)}
			/>
			{asset ? (
				<ContextConnectionDialog
					visible={contextVisible}
					fromAsset={asset}
					preferredContextId={contextPrefill?.contextId}
					preferredDockpartId={contextPrefill?.dockpartId}
					onCancel={closeContextDialog}
					onCreated={(connectionId) => {
						closeContextDialog();
						setEditingConnectionId(connectionId);
					}}
				/>
			) : null}
			{asset ? (
				<BridgeConnectionDialog
					visible={bridgeVisible}
					fromAsset={asset}
					onCancel={() => setBridgeVisible(false)}
					onCreated={(connectionId) => setEditingConnectionId(connectionId)}
				/>
			) : null}
			<ConnectionEditDialog
				connectionId={editingConnectionId}
				onClose={() => setEditingConnectionId(null)}
			/>
			<ConnectionOverviewDialog
				visible={overviewVisible}
				currentAsset={asset}
				onClose={() => setOverviewVisible(false)}
			/>
		</Fragment>
	);
});

export default ConnectionMapping;
