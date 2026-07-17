import React, { useMemo, useState } from "react";
import { Button, Input, Modal, Select, Space, message } from "antd";
import { observer } from "mobx-react";
import { IAsset } from "../../Stores/Models/Asset.Model";
import { rootStore } from "../../Stores/Root.Store";
import { assetDisplayName } from "../../lib/connectionCandidateFilter";
import { ConnectionDirection } from "../../lib/connectionDirection";
import { connectionDirectionSelectOptions } from "../../lib/connectionDirection";

interface LogicalConnectionDialogProps {
	visible: boolean;
	fromAsset: IAsset;
	onCancel: () => void;
	onCreated?: (connectionId: string) => void;
}

const LogicalConnectionDialog: React.FC<LogicalConnectionDialogProps> = ({
	visible,
	fromAsset,
	onCancel,
	onCreated,
}) => {
	const [toAssetId, setToAssetId] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [direction, setDirection] = useState<ConnectionDirection>("LOGICAL");

	const candidates = useMemo(
		() => rootStore.assets.assets.filter((asset) => asset.id !== fromAsset.id),
		[fromAsset.id, rootStore.assets.assets.length]
	);

	const reset = () => {
		setToAssetId(null);
		setTitle("");
		setDescription("");
		setDirection("LOGICAL");
	};

	const handleCancel = () => {
		reset();
		onCancel();
	};

	const handleCreate = () => {
		if (!toAssetId) {
			return;
		}
		try {
			const connection = rootStore.connections.createLogicalConnection({
				fromAssetId: fromAsset.id,
				toAssetId,
				title: title.trim() || undefined,
				definitionLabel: title.trim() || undefined,
				definitionDescription: description.trim() || undefined,
				direction,
			});
			message.success("Logische Verbindung erstellt");
			onCreated?.(connection.id);
			reset();
			onCancel();
		} catch (error) {
			message.error(error instanceof Error ? error.message : "Verbindung konnte nicht erstellt werden.");
		}
	};

	return (
		<Modal
			title="Logische Verbindung"
			open={visible}
			onCancel={handleCancel}
			footer={
				<Space>
					<Button onClick={handleCancel}>Abbrechen</Button>
					<Button type="primary" disabled={!toAssetId} onClick={handleCreate}>
						Erstellen
					</Button>
				</Space>
			}
		>
			<Space direction="vertical" style={{ width: "100%" }} size="middle">
				<div>
					<strong>Von:</strong> {assetDisplayName(fromAsset)}
				</div>
				<Select
					showSearch
					placeholder="Ziel-Asset wählen"
					style={{ width: "100%" }}
					value={toAssetId ?? undefined}
					onChange={(value) => setToAssetId(value)}
					options={candidates.map((asset) => ({
						value: asset.id,
						label: assetDisplayName(asset),
					}))}
					optionFilterProp="label"
				/>
				<Input
					placeholder="Titel / Label (optional)"
					value={title}
					onChange={(event) => setTitle(event.target.value)}
				/>
				<Input.TextArea
					placeholder="Beschreibung (optional)"
					value={description}
					onChange={(event) => setDescription(event.target.value)}
					autoSize={{ minRows: 1, maxRows: 3 }}
				/>
				<Select
					style={{ width: "100%" }}
					value={direction}
					onChange={setDirection}
					options={connectionDirectionSelectOptions()}
				/>
			</Space>
		</Modal>
	);
};

export default observer(LogicalConnectionDialog);
