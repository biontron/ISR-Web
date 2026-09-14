import React, { useMemo, useState } from "react";
import { Button, Input, Modal, Select, Space, message } from "antd";
import { observer } from "mobx-react";
import { IAsset } from "../../Stores/Models/Asset.Model";
import { IGroup } from "../../Stores/Models/Group.Model";
import { rootStore } from "../../Stores/Root.Store";
import { ConnectionDirection, connectionDirectionSelectOptions } from "../../lib/connectionDirection";
import { collectLogicalEndpointOptions, formatLogicalEndpointName } from "../../lib/connectionLogicalEndpoints";
import { useLangtext } from "../../lib/common";

interface LogicalConnectionDialogProps {
	visible: boolean;
	fromElement: IAsset | IGroup;
	onCancel: () => void;
	onCreated?: (connectionId: string) => void;
}

const LogicalConnectionDialog: React.FC<LogicalConnectionDialogProps> = ({
	visible,
	fromElement,
	onCancel,
	onCreated,
}) => {
	const langtext = useLangtext();
	const [toElementId, setToElementId] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [direction, setDirection] = useState<ConnectionDirection>("LOGICAL");

	const candidates = useMemo(
		() =>
			collectLogicalEndpointOptions(
				rootStore.assets.assets.slice(),
				rootStore.groups.groups.slice(),
				fromElement.id
			),
		[fromElement.id, rootStore.assets.assets.length, rootStore.groups.groups.length]
	);

	const reset = () => {
		setToElementId(null);
		setTitle("");
		setDescription("");
		setDirection("LOGICAL");
	};

	const handleCancel = () => {
		reset();
		onCancel();
	};

	const handleCreate = () => {
		if (!toElementId) {
			return;
		}
		try {
			const connection = rootStore.connections.createLogicalConnection({
				fromElementId: fromElement.id,
				toElementId,
				title: title.trim() || undefined,
				definitionLabel: title.trim() || undefined,
				definitionDescription: description.trim() || undefined,
				direction,
			});
			message.success(langtext("general.connection_logical_add"));
			onCreated?.(connection.id);
			reset();
			onCancel();
		} catch (error) {
			message.error(error instanceof Error ? error.message : langtext("general.connection_create_failed"));
		}
	};

	return (
		<Modal
			title={langtext("general.connection_logical_add")}
			open={visible}
			onCancel={handleCancel}
			footer={
				<Space>
					<Button onClick={handleCancel}>{langtext("general.cancel")}</Button>
					<Button type="primary" disabled={!toElementId} onClick={handleCreate}>
						{langtext("general.create")}
					</Button>
				</Space>
			}
		>
			<Space direction="vertical" style={{ width: "100%" }} size="middle">
				<div>
					<strong>{langtext("general.connection_overview_col_from")}:</strong>{" "}
					{formatLogicalEndpointName(fromElement)}
				</div>
				<Select
					showSearch
					placeholder={langtext("general.connection_overview_col_to")}
					style={{ width: "100%" }}
					value={toElementId ?? undefined}
					onChange={(value) => setToElementId(value)}
					options={candidates.map((entry) => ({
						value: entry.id,
						label: entry.label,
					}))}
					optionFilterProp="label"
				/>
				<Input
					placeholder={langtext("general.connection_title_optional")}
					value={title}
					onChange={(event) => setTitle(event.target.value)}
				/>
				<Input.TextArea
					placeholder={langtext("general.connection_title_optional")}
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
