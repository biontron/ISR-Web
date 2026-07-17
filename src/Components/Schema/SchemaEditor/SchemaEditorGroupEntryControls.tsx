/*
# SPDX-License-Identifier: GPL-2.0*/

import React from "react";
import { Button, Tooltip } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined } from "@ant-design/icons";
import { useLangtext } from "../../../lib/common";

interface SchemaEditorGroupEntryControlsProps {
	canMoveUp: boolean;
	canMoveDown: boolean;
	canRemove?: boolean;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onRemove?: () => void;
}

const SchemaEditorGroupEntryControls: React.FC<SchemaEditorGroupEntryControlsProps> = ({
	canMoveUp,
	canMoveDown,
	canRemove = false,
	onMoveUp,
	onMoveDown,
	onRemove,
}) => {
	const langtext = useLangtext();

	return (
		<div className="schema-group-entry-controls">
			<Tooltip title={langtext("schema_editor.move_up")}>
				<Button
					type="text"
					size="small"
					icon={<ArrowUpOutlined />}
					disabled={!canMoveUp}
					onClick={onMoveUp}
					aria-label={langtext("schema_editor.move_up")}
				/>
			</Tooltip>
			<Tooltip title={langtext("schema_editor.move_down")}>
				<Button
					type="text"
					size="small"
					icon={<ArrowDownOutlined />}
					disabled={!canMoveDown}
					onClick={onMoveDown}
					aria-label={langtext("schema_editor.move_down")}
				/>
			</Tooltip>
			{onRemove && (
				<Tooltip title={langtext("schema_editor.remove_entry")}>
					<Button
						type="text"
						size="small"
						danger
						icon={<DeleteOutlined />}
						disabled={!canRemove}
						onClick={onRemove}
						aria-label={langtext("schema_editor.remove_entry")}
					/>
				</Tooltip>
			)}
		</div>
	);
};

export default SchemaEditorGroupEntryControls;
