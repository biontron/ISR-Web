/*
# SPDX-License-Identifier: GPL-2.0
*/
import React, { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Space, Table, Tooltip } from "antd";
import { CodeOutlined } from "@ant-design/icons";
import { observer } from "mobx-react";
import { useLangtext } from "../../lib/common";
import { JsonInspectTarget } from "../../lib/jsonInspectResolve";
import JsonInspectDialog from "../ChangeMode/JsonInspectDialog";
import NamedDeleteDialog, { NamedDeleteTarget } from "./NamedDeleteDialog";

export type CatalogAdminItem = {
	id: string;
	name: string;
};

interface CatalogAdminDialogProps {
	open: boolean;
	kind: "view" | "environment";
	title: string;
	items: CatalogAdminItem[];
	canEdit: boolean;
	initialId?: string;
	idFromName?: (name: string) => string;
	onClose: () => void;
	onCreate: (name: string) => Promise<void> | void;
	onRename: (id: string, name: string) => Promise<void> | void;
	onDelete: (id: string) => Promise<void> | void;
	onExport: (id: string) => void;
	resolveInspect?: (id: string) => JsonInspectTarget | null;
}

const CatalogAdminDialog: React.FC<CatalogAdminDialogProps> = observer(({
	open,
	kind,
	title,
	items,
	canEdit,
	initialId,
	idFromName,
	onClose,
	onCreate,
	onRename,
	onDelete,
	onExport,
	resolveInspect,
}) => {
	const langtext = useLangtext();
	const [selectedId, setSelectedId] = useState("");
	const [createOpen, setCreateOpen] = useState(false);
	const [renameOpen, setRenameOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [inspectId, setInspectId] = useState("");
	const [nameDraft, setNameDraft] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!open) {
			setCreateOpen(false);
			setRenameOpen(false);
			setDeleteOpen(false);
			setInspectId("");
			setNameDraft("");
			return;
		}
		const fallback = items[0]?.id ?? "";
		setSelectedId(items.some((item) => item.id === initialId) ? initialId ?? fallback : fallback);
	}, [open, initialId, items]);

	const selected = items.find((item) => item.id === selectedId);
	const inspectTarget = inspectId && resolveInspect ? resolveInspect(inspectId) : null;
	const createdIdPreview = idFromName ? idFromName(nameDraft) : "";
	const deleteTargets: NamedDeleteTarget[] = selected
		? [{ id: selected.id, name: selected.name }]
		: [];

	const columns = useMemo(
		() => [
			{ title: langtext("general.catalog_name"), dataIndex: "name", key: "name" },
			{ title: langtext("general.catalog_id"), dataIndex: "id", key: "id" },
			...(resolveInspect
				? [
						{
							title: "",
							key: "inspect",
							width: 48,
							render: (_: unknown, record: CatalogAdminItem) => (
								<Tooltip title={langtext("general.json_inspect")}>
									<Button
										size="small"
										type="text"
										icon={<CodeOutlined />}
										aria-label={langtext("general.json_inspect")}
										onClick={(event) => {
											event.stopPropagation();
											setSelectedId(record.id);
											setInspectId(record.id);
										}}
									/>
								</Tooltip>
							),
						},
					]
				: []),
		],
		[langtext, resolveInspect]
	);

	return (
		<>
			<Modal
				open={open}
				title={title}
				onCancel={onClose}
				footer={null}
				width={720}
				destroyOnClose
			>
				<Table
					rowKey="id"
					size="small"
					pagination={false}
					dataSource={items}
					columns={columns}
					rowSelection={{
						type: "radio",
						selectedRowKeys: selectedId ? [selectedId] : [],
						onChange: (keys) => setSelectedId(String(keys[0] ?? "")),
					}}
					onRow={(record) => ({
						onClick: () => setSelectedId(record.id),
					})}
					locale={{ emptyText: langtext("general.catalog_empty") }}
				/>
				<Space style={{ marginTop: 16 }} wrap>
					<Button
						type="primary"
						disabled={!canEdit}
						onClick={() => {
							setNameDraft("");
							setCreateOpen(true);
						}}
					>
						{langtext("general.catalog_create")}
					</Button>
					<Button
						disabled={!canEdit || !selected}
						onClick={() => {
							setNameDraft(selected?.name ?? "");
							setRenameOpen(true);
						}}
					>
						{langtext("general.catalog_rename")}
					</Button>
					<Button
						danger
						disabled={!canEdit || !selected}
						onClick={() => setDeleteOpen(true)}
					>
						{langtext("general.catalog_delete")}
					</Button>
					<Button disabled={!selected} onClick={() => selected && onExport(selected.id)}>
						{langtext("general.catalog_export")}
					</Button>
				</Space>
			</Modal>

			<Modal
				open={createOpen}
				title={langtext("general.catalog_create")}
				okText={langtext("general.catalog_create")}
				cancelText={langtext("general.cancel")}
				confirmLoading={busy}
				okButtonProps={{ disabled: !nameDraft.trim() || (idFromName ? !createdIdPreview : false) }}
				onCancel={() => setCreateOpen(false)}
				onOk={async () => {
					if (!nameDraft.trim()) {
						return;
					}
					setBusy(true);
					try {
						await onCreate(nameDraft.trim());
						setCreateOpen(false);
					} finally {
						setBusy(false);
					}
				}}
			>
				<label style={{ display: "block", marginBottom: 8 }}>
					{langtext("general.catalog_name")}
				</label>
				<Input
					autoFocus
					value={nameDraft}
					onChange={(event) => setNameDraft(event.target.value)}
				/>
				{idFromName ? (
					<p style={{ marginTop: 12, color: "#666" }}>
						{langtext("general.catalog_id")}: {createdIdPreview || "—"}
					</p>
				) : null}
			</Modal>

			<Modal
				open={renameOpen}
				title={langtext("general.catalog_rename")}
				okText={langtext("general.save")}
				cancelText={langtext("general.cancel")}
				confirmLoading={busy}
				okButtonProps={{ disabled: !nameDraft.trim() }}
				onCancel={() => setRenameOpen(false)}
				onOk={async () => {
					if (!selected || !nameDraft.trim()) {
						return;
					}
					setBusy(true);
					try {
						await onRename(selected.id, nameDraft.trim());
						setRenameOpen(false);
					} finally {
						setBusy(false);
					}
				}}
			>
				<label style={{ display: "block", marginBottom: 8 }}>
					{langtext("general.catalog_name")}
				</label>
				<Input
					autoFocus
					value={nameDraft}
					onChange={(event) => setNameDraft(event.target.value)}
				/>
			</Modal>

			<JsonInspectDialog
				open={Boolean(inspectTarget)}
				target={inspectTarget}
				onClose={() => setInspectId("")}
			/>

			<NamedDeleteDialog
				open={deleteOpen}
				kind={kind}
				targets={deleteTargets}
				initialId={selected?.id}
				onCancel={() => setDeleteOpen(false)}
				onConfirm={async (id) => {
					setDeleteOpen(false);
					await onDelete(id);
				}}
			/>
		</>
	);
});

export default CatalogAdminDialog;
