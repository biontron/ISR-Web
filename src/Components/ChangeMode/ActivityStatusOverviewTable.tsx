/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { useMemo, useState } from "react";
import { Button, Space, Table, Tooltip, Typography } from "antd";
import type { ColumnsType, TableRowSelection } from "antd/es/table/interface";
import { CodeOutlined, UndoOutlined, SaveOutlined } from "@ant-design/icons";
import { ActivityStatusRow } from "../../lib/activityStatusOverview";
import { useLangtext } from "../../lib/common";
import {
	formatHttpStatusForDisplay,
	getHttpStatusToneClass,
} from "../../lib/storeFailureFormat";
import ActivityStatusRestPopover from "./ActivityStatusRestPopover";

const ACTIVITY_ORDER: Record<ActivityStatusRow["activity"], number> = {
	"read-interface": 0,
	"read-interface-error": 1,
	"read-error": 2,
	create: 3,
	update: 4,
	delete: 5,
	"store-error": 6,
};

interface ActivityStatusOverviewTableProps {
	rows: ActivityStatusRow[];
	showSelection?: boolean;
	showRowActions?: boolean;
	savingRowKey?: string | null;
	selectedRowKeys: React.Key[];
	onSelectionChange: (keys: React.Key[], rows: ActivityStatusRow[]) => void;
	onSave?: (row: ActivityStatusRow) => void;
	onUndo?: (row: ActivityStatusRow) => void;
	onJsonInspect?: (row: ActivityStatusRow) => void;
}

const ActivityStatusOverviewTable: React.FC<ActivityStatusOverviewTableProps> = ({
	rows,
	showSelection = false,
	showRowActions = false,
	savingRowKey = null,
	selectedRowKeys,
	onSelectionChange,
	onSave,
	onUndo,
	onJsonInspect,
}) => {
	const langtext = useLangtext();
	const [sortField, setSortField] = useState<string>("kind");
	const [sortOrder, setSortOrder] = useState<"ascend" | "descend">("ascend");

	const sortedRows = useMemo(() => {
		const copy = [...rows];
		copy.sort((a, b) => {
			let cmp = 0;
			switch (sortField) {
				case "activity":
					cmp = ACTIVITY_ORDER[a.activity] - ACTIVITY_ORDER[b.activity];
					break;
				case "kind":
					cmp = a.kind.localeCompare(b.kind);
					break;
				case "name":
					cmp = a.name.localeCompare(b.name);
					break;
				case "httpStatus":
					cmp = (a.httpStatus ?? -1) - (b.httpStatus ?? -1);
					break;
				case "errorMessage":
					cmp = (a.errorMessage ?? "").localeCompare(b.errorMessage ?? "");
					break;
				default:
					cmp = 0;
			}
			if (cmp === 0) {
				cmp = a.name.localeCompare(b.name);
			}
			return sortOrder === "ascend" ? cmp : -cmp;
		});
		return copy;
	}, [rows, sortField, sortOrder]);

	const rowSelection: TableRowSelection<ActivityStatusRow> | undefined = showSelection
		? {
			selectedRowKeys,
			onChange: (keys, selectedRows) => onSelectionChange(keys, selectedRows),
		}
		: undefined;

	const columns: ColumnsType<ActivityStatusRow> = [
		{
			title: langtext("general.activity_status_column_activity"),
			dataIndex: "activity",
			key: "activity",
			sorter: true,
			sortOrder: sortField === "activity" ? sortOrder : undefined,
			render: (activity: ActivityStatusRow["activity"]) =>
				langtext(`general.activity_status_activity_${activity.replace(/-/g, "_")}`),
		},
		{
			title: langtext("general.activity_status_column_type"),
			dataIndex: "kind",
			key: "kind",
			sorter: true,
			sortOrder: sortField === "kind" ? sortOrder : undefined,
		},
		{
			title: langtext("general.activity_status_column_name"),
			dataIndex: "name",
			key: "name",
			sorter: true,
			sortOrder: sortField === "name" ? sortOrder : undefined,
		},
		{
			title: langtext("general.activity_status_column_http"),
			dataIndex: "httpStatus",
			key: "httpStatus",
			sorter: true,
			sortOrder: sortField === "httpStatus" ? sortOrder : undefined,
			render: (_value: number | undefined, row: ActivityStatusRow) => {
				const label = formatHttpStatusForDisplay(row.httpStatus, row.isNetworkError);
				const toneClass = getHttpStatusToneClass(row.httpStatus, row.isNetworkError);

				return (
					<ActivityStatusRestPopover row={row}>
						<span className={`activity-status-http-trigger ${toneClass}`}>{label}</span>
					</ActivityStatusRestPopover>
				);
			},
		},
		{
			title: langtext("general.activity_status_column_error"),
			dataIndex: "errorMessage",
			key: "errorMessage",
			sorter: true,
			sortOrder: sortField === "errorMessage" ? sortOrder : undefined,
			ellipsis: true,
			render: (text?: string, row?: ActivityStatusRow) => {
				if (!text || !row) {
					return "—";
				}
				const textType =
					row.activity === "read-interface-error" ||
					row.activity === "read-error" ||
					row.activity === "store-error"
						? "danger"
						: row.activity === "read-interface"
							? "success"
							: undefined;

				return (
					<ActivityStatusRestPopover row={row}>
						<Typography.Text
							type={textType}
							ellipsis
							className="activity-status-error-trigger"
						>
							{text}
						</Typography.Text>
					</ActivityStatusRestPopover>
				);
			},
		},
		{
			title: langtext("general.activity_status_column_actions"),
			key: "actions",
			render: (_, row) => (
				<Space size="small">
					{showRowActions && row.touchedRef && (
						<Tooltip title={langtext("general.activity_status_save_row")}>
							<Button
								size="small"
								type="primary"
								icon={<SaveOutlined />}
								loading={savingRowKey === row.rowKey}
								disabled={!!savingRowKey && savingRowKey !== row.rowKey}
								onClick={() => onSave?.(row)}
							/>
						</Tooltip>
					)}
					{showRowActions && row.touchedRef && (
						<Tooltip title={langtext("general.edit_reset")}>
							<Button
								size="small"
								icon={<UndoOutlined />}
								disabled={!!savingRowKey}
								onClick={() => onUndo?.(row)}
							/>
						</Tooltip>
					)}
					<Tooltip title={langtext("general.json_inspect")}>
						<Button
							size="small"
							icon={<CodeOutlined />}
							onClick={() => onJsonInspect?.(row)}
						/>
					</Tooltip>
				</Space>
			),
		},
	];

	return (
		<Table
			size="small"
			rowKey="rowKey"
			dataSource={sortedRows}
			columns={columns}
			rowSelection={rowSelection}
			pagination={rows.length > 50 ? { pageSize: 50 } : false}
			rowClassName={(row) =>
				row.activity === "read-interface-error" ||
				row.activity === "read-error" ||
				row.activity === "store-error"
					? "activity-status-row-error"
					: row.activity === "read-interface"
						? "activity-status-row-success"
						: ""
			}
			onChange={(_pagination, _filters, sorter) => {
				if (!Array.isArray(sorter) && sorter.field) {
					setSortField(String(sorter.field));
					setSortOrder(sorter.order === "descend" ? "descend" : "ascend");
				}
			}}
		/>
	);
};

export default ActivityStatusOverviewTable;
