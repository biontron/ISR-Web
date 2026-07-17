import React, { useEffect, useState } from "react";
import { Button, Modal, Space, Table, Tag } from "antd";
import { observer } from "mobx-react";
import { rootStore } from "../../Stores/Root.Store";
import { IConnectSchemaModel } from "../../Stores/Models/ConnectSchema.Model";
import { getLanguageText } from "../../lib/common";

interface DockpartSchemaSelectionDialogProps {
	visible: boolean;
	onCancel: () => void;
	onSelect: (schemaIds: string[]) => void;
}

const DockpartSchemaSelectionDialog: React.FC<DockpartSchemaSelectionDialogProps> = ({
	visible,
	onCancel,
	onSelect,
}) => {
	const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
	const schemas = rootStore.configSchemas.dockparts.slice();

	useEffect(() => {
		if (visible) {
			setSelectedRowKeys([]);
		}
	}, [visible]);

	const columns = [
		{
			title: "ID",
			dataIndex: "id",
			key: "id",
		},
		{
			title: "Type",
			dataIndex: "type",
			key: "type",
			render: (type: string) => <Tag>{type}</Tag>,
		},
		{
			title: "Name",
			key: "name",
			render: (_: unknown, record: IConnectSchemaModel) =>
				getLanguageText(record.name as any),
		},
	];

	const rowSelection = {
		type: "checkbox" as const,
		selectedRowKeys,
		onChange: (keys: React.Key[]) => {
			setSelectedRowKeys(keys as string[]);
		},
	};

	const toggleRow = (schemaId: string) => {
		setSelectedRowKeys((prev) =>
			prev.includes(schemaId) ? prev.filter((id) => id !== schemaId) : [...prev, schemaId]
		);
	};

	const handleConfirm = () => {
		if (selectedRowKeys.length === 0) {
			return;
		}
		onSelect(selectedRowKeys);
	};

	return (
		<Modal
			title="Dockpart-Schema auswählen"
			open={visible}
			onCancel={onCancel}
			width={720}
			footer={
				<Space>
					<Button onClick={onCancel}>Abbrechen</Button>
					<Button type="primary" disabled={selectedRowKeys.length === 0} onClick={handleConfirm}>
						Hinzufügen
					</Button>
				</Space>
			}
		>
			<Table
				rowKey="id"
				dataSource={schemas}
				columns={columns}
				pagination={false}
				rowSelection={rowSelection}
				onRow={(record) => ({
					onClick: () => toggleRow(record.id),
					style: { cursor: "pointer" },
				})}
			/>
		</Modal>
	);
};

export default observer(DockpartSchemaSelectionDialog);
