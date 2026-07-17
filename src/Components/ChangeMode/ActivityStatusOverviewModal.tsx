/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { useEffect, useState } from "react";
import { Alert, Button, Modal, Space, Tabs, Typography, message } from "antd";
import { observer } from "mobx-react";
import { rootStore } from "../../Stores/Root.Store";
import {
	ActivityStatusRow,
	collectReadInterfaceRows,
	collectReadObjectErrorRows,
	collectReadTabRows,
	collectWriteActivityRows,
} from "../../lib/activityStatusOverview";
import { activityStatusOverviewUi } from "../../lib/activityStatusOverviewUi";
import {
	discardTouchedRefs,
	saveTouchedRefs,
} from "../../lib/activityStatusActions";
import { undoTouchedObject } from "../../lib/touchedObjects";
import { exportActivityStatusZip } from "../../lib/exportActivityStatusZip";
import { useLangtext } from "../../lib/common";
import ActivityStatusOverviewTable from "./ActivityStatusOverviewTable";
import JsonInspectDialog from "./JsonInspectDialog";
import { JsonInspectTarget } from "../../lib/jsonInspectResolve";

function rowToJsonTarget(row: ActivityStatusRow): JsonInspectTarget {
	const baseline =
		row.touchedRef?.element &&
		(row.touchedRef.element as { editSnapshot?: unknown; deleteSnapshot?: unknown }).editSnapshot
			? (row.touchedRef.element as { editSnapshot?: unknown }).editSnapshot
			: row.touchedRef?.element &&
				  (row.touchedRef.element as { deleteSnapshot?: unknown }).deleteSnapshot
				? (row.touchedRef.element as { deleteSnapshot?: unknown }).deleteSnapshot
				: undefined;

	return {
		kind: row.kind,
		title: row.name,
		current: row.rest.payload ?? {},
		baseline: baseline as Record<string, unknown> | undefined,
	};
}

const ActivityStatusOverviewModal: React.FC = observer(() => {
	const langtext = useLangtext();
	const [activeTab, setActiveTab] = useState<"read" | "write">("write");
	const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
	const [selectedRows, setSelectedRows] = useState<ActivityStatusRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [savingRowKey, setSavingRowKey] = useState<string | null>(null);
	const [saveSummary, setSaveSummary] = useState<string | null>(null);
	const [jsonTarget, setJsonTarget] = useState<JsonInspectTarget | null>(null);

	const isOpen = activityStatusOverviewUi.open;
	const interfaceRows = isOpen ? collectReadInterfaceRows() : [];
	const objectRows = isOpen ? collectReadObjectErrorRows() : [];
	const readRows = isOpen ? collectReadTabRows(rootStore) : [];
	const writeRows = isOpen ? collectWriteActivityRows(rootStore) : [];
	const writeRowKeySignature = writeRows.map((row) => row.rowKey).join("\0");

	useEffect(() => {
		if (isOpen) {
			setActiveTab(activityStatusOverviewUi.initialTab);
			setSaveSummary(null);
		}
	}, [isOpen, activityStatusOverviewUi.initialTab]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		if (activeTab !== "write") {
			setSelectedRowKeys((prev) => (prev.length === 0 ? prev : []));
			setSelectedRows((prev) => (prev.length === 0 ? prev : []));
			return;
		}

		const keys = writeRows.map((row) => row.rowKey);
		setSelectedRowKeys((prev) =>
			prev.length === keys.length && prev.every((key, index) => key === keys[index])
				? prev
				: keys
		);
		setSelectedRows((prev) =>
			prev.length === writeRows.length &&
			prev.every((row, index) => row.rowKey === writeRows[index].rowKey)
				? prev
				: writeRows
		);
	}, [isOpen, activeTab, writeRowKeySignature]);

	const handleClose = () => {
		activityStatusOverviewUi.close();
	};

	const handleSave = async (rowsToSave: ActivityStatusRow[] = selectedRows) => {
		const refs = rowsToSave
			.map((row) => row.touchedRef)
			.filter((ref): ref is NonNullable<typeof ref> => !!ref);

		if (refs.length === 0) {
			return;
		}

		setLoading(true);
		try {
			const { saved, failed } = await saveTouchedRefs(rootStore, refs);
			setSaveSummary(
				langtext("general.activity_status_save_summary", {
					saved: String(saved),
					failed: String(failed.length),
				})
			);
		} finally {
			setLoading(false);
		}
	};

	const handleSaveRow = async (row: ActivityStatusRow) => {
		if (!row.touchedRef) {
			return;
		}
		setSavingRowKey(row.rowKey);
		try {
			const { saved, failed } = await saveTouchedRefs(rootStore, [row.touchedRef]);
			setSaveSummary(
				langtext("general.activity_status_save_summary", {
					saved: String(saved),
					failed: String(failed.length),
				})
			);
		} finally {
			setSavingRowKey(null);
		}
	};

	const handleDiscard = () => {
		const refs = selectedRows
			.map((row) => row.touchedRef)
			.filter((ref): ref is NonNullable<typeof ref> => !!ref);
		discardTouchedRefs(rootStore, refs);
		setSaveSummary(null);
	};

	const handleExportZip = async () => {
		const rows = selectedRows.length > 0 ? selectedRows : activeTab === "read" ? readRows : writeRows;
		if (rows.length === 0) {
			return;
		}
		await exportActivityStatusZip(rows);
		message.success(langtext("general.activity_status_export_zip_success"));
	};

	const handleUndo = (row: ActivityStatusRow) => {
		if (!row.touchedRef) {
			return;
		}
		undoTouchedObject(rootStore, row.touchedRef);
	};

	const unsavedCount = writeRows.filter((row) => row.touchedRef).length;
	const showUnsavedHint = activityStatusOverviewUi.showUnsavedHint && unsavedCount > 0;

	return (
		<>
			<Modal
				open={activityStatusOverviewUi.open}
				title={langtext("general.activity_status_overview_title")}
				onCancel={handleClose}
				width={960}
				footer={[
					<Button key="close" onClick={handleClose}>
						{langtext("general.activity_status_close")}
					</Button>,
				]}
				destroyOnClose
			>
				<Tabs
					activeKey={activeTab}
					onChange={(key) => setActiveTab(key as "read" | "write")}
					items={[
						{
							key: "read",
							label: langtext("general.activity_status_tab_read"),
							children: (
								<>
									{interfaceRows.length === 0 && objectRows.length === 0 && (
										<Alert
											type="info"
											showIcon
											message={langtext("general.activity_status_read_empty")}
											style={{ marginBottom: 12 }}
										/>
									)}

									{interfaceRows.length > 0 && (
										<>
											<Typography.Title level={5} style={{ marginTop: 0 }}>
												{langtext("general.activity_status_section_interfaces")}
											</Typography.Title>
											<ActivityStatusOverviewTable
												rows={interfaceRows}
												selectedRowKeys={selectedRowKeys}
												onSelectionChange={(keys, rows) => {
													setSelectedRowKeys(keys);
													setSelectedRows(rows);
												}}
												onJsonInspect={(row) => setJsonTarget(rowToJsonTarget(row))}
											/>
										</>
									)}

									{objectRows.length > 0 && (
										<>
											<Typography.Title level={5}>
												{langtext("general.activity_status_section_objects")}
											</Typography.Title>
											<ActivityStatusOverviewTable
												rows={objectRows}
												selectedRowKeys={selectedRowKeys}
												onSelectionChange={(keys, rows) => {
													setSelectedRowKeys(keys);
													setSelectedRows(rows);
												}}
												onJsonInspect={(row) => setJsonTarget(rowToJsonTarget(row))}
											/>
										</>
									)}
								</>
							),
						},
						{
							key: "write",
							label: langtext("general.activity_status_tab_write"),
							children: (
								<>
									{showUnsavedHint && (
										<Alert
											type="warning"
											showIcon
											message={langtext("general.activity_status_unsaved_hint", {
												count: String(unsavedCount),
											})}
											style={{ marginBottom: 12 }}
										/>
									)}
									{saveSummary && (
										<Alert type="warning" message={saveSummary} style={{ marginBottom: 12 }} />
									)}
									<Space style={{ marginBottom: 12 }}>
										<Button
											type="primary"
											loading={loading}
											disabled={selectedRows.length === 0}
											onClick={() => handleSave()}
										>
											{langtext("general.activity_status_save_selection")}
										</Button>
										<Button
											danger
											disabled={selectedRows.length === 0 || loading}
											onClick={handleDiscard}
										>
											{langtext("general.activity_status_discard_selection")}
										</Button>
										<Button disabled={selectedRows.length === 0} onClick={handleExportZip}>
											{langtext("general.activity_status_export_zip")}
										</Button>
									</Space>
									<ActivityStatusOverviewTable
										rows={writeRows}
										showSelection
										showRowActions
										savingRowKey={savingRowKey}
										selectedRowKeys={selectedRowKeys}
										onSelectionChange={(keys, rows) => {
											setSelectedRowKeys(keys);
											setSelectedRows(rows);
										}}
										onSave={handleSaveRow}
										onUndo={handleUndo}
										onJsonInspect={(row) => setJsonTarget(rowToJsonTarget(row))}
									/>
								</>
							),
						},
					]}
				/>
			</Modal>

			<JsonInspectDialog
				open={!!jsonTarget}
				target={jsonTarget}
				onClose={() => setJsonTarget(null)}
			/>
		</>
	);
});

export default ActivityStatusOverviewModal;
