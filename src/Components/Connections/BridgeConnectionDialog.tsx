import React, { useMemo, useState } from "react";
import { Button, Input, Modal, Select, Space, message } from "antd";
import { observer } from "mobx-react";
import { IAsset } from "../../Stores/Models/Asset.Model";
import { rootStore } from "../../Stores/Root.Store";
import { assetDisplayName } from "../../lib/connectionCandidateFilter";
import { useLangtext } from "../../lib/common";

interface BridgeConnectionDialogProps {
	visible: boolean;
	fromAsset: IAsset;
	onCancel: () => void;
	onCreated?: (connectionId: string) => void;
}

const BridgeConnectionDialog: React.FC<BridgeConnectionDialogProps> = ({
	visible,
	fromAsset,
	onCancel,
	onCreated,
}) => {
	const langtext = useLangtext();
	const [peerEnvironmentRef, setPeerEnvironmentRef] = useState<string | undefined>();
	const [toAssetId, setToAssetId] = useState<string | undefined>();
	const [title, setTitle] = useState("");

	const environments = rootStore.environments.environments.slice();
	const peerAssets = useMemo(
		() =>
			rootStore.assets.assets.filter(
				(asset) =>
					asset.id !== fromAsset.id &&
					(!peerEnvironmentRef || asset.environmentId === peerEnvironmentRef)
			),
		[fromAsset.id, peerEnvironmentRef, rootStore.assets.assets.length]
	);

	const reset = () => {
		setPeerEnvironmentRef(undefined);
		setToAssetId(undefined);
		setTitle("");
	};

	const handleCreate = () => {
		if (!peerEnvironmentRef) {
			return;
		}
		try {
			const connection = rootStore.connections.createBridgeConnection({
				fromAssetId: fromAsset.id,
				toAssetId,
				peerEnvironmentRef,
				title: title.trim() || undefined,
				definitionLabel: title.trim() || undefined,
			});
			message.success(langtext("general.connection_bridge_created"));
			onCreated?.(connection.id);
			reset();
			onCancel();
		} catch (error) {
			message.error(error instanceof Error ? error.message : langtext("general.connection_create_failed"));
		}
	};

	return (
		<Modal
			title={langtext("general.connection_bridge_add")}
			open={visible}
			onCancel={() => {
				reset();
				onCancel();
			}}
			footer={
				<Space>
					<Button onClick={onCancel}>{langtext("general.cancel")}</Button>
					<Button type="primary" disabled={!peerEnvironmentRef} onClick={handleCreate}>
						{langtext("general.create")}
					</Button>
				</Space>
			}
		>
			<Space direction="vertical" style={{ width: "100%" }} size="middle">
				<div>
					<strong>{langtext("general.connection_overview_col_from")}:</strong> {assetDisplayName(fromAsset)}
				</div>
				<Select
					placeholder={langtext("general.connection_bridge_peer_env")}
					style={{ width: "100%" }}
					value={peerEnvironmentRef}
					onChange={(value) => {
						setPeerEnvironmentRef(value);
						setToAssetId(undefined);
					}}
					options={environments.map((environment) => ({
						value: environment.id,
						label: environment.definition?.name || environment.id,
					}))}
				/>
				<Select
					allowClear
					showSearch
					placeholder={langtext("general.connection_bridge_peer_asset")}
					style={{ width: "100%" }}
					value={toAssetId}
					onChange={setToAssetId}
					options={peerAssets.map((asset) => ({
						value: asset.id,
						label: assetDisplayName(asset),
					}))}
					optionFilterProp="label"
				/>
				<Input
					placeholder={langtext("general.connection_title_optional")}
					value={title}
					onChange={(event) => setTitle(event.target.value)}
				/>
			</Space>
		</Modal>
	);
};

export default observer(BridgeConnectionDialog);
