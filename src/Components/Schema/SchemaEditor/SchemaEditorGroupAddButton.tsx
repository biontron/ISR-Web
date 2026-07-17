/*
# SPDX-License-Identifier: GPL-2.0*/

import React from "react";
import { Button, Space, Tag } from "antd";
import { useLangtext } from "../../../lib/common";

interface SchemaEditorGroupAddButtonProps {
	canAdd: boolean;
	minUsage: number;
	maxUsage: number;
	currentUsage?: number;
	onAdd: () => void;
	onAddGroup?: () => void;
	isUsageOutOfBounds?: boolean;
}

const SchemaEditorGroupAddButton: React.FC<SchemaEditorGroupAddButtonProps> = ({
	minUsage,
	maxUsage,
	currentUsage,
	canAdd,
	onAdd,
	onAddGroup,
	isUsageOutOfBounds = false,
}) => {
	const langtext = useLangtext();
	const showUsageCount = minUsage !== 1 || maxUsage !== 1;
	const addLabel = onAddGroup ? langtext("schema_editor.add_field") : langtext("general.add");

	return (
		<span className="schema-group-add-controls">
			<Space size={4}>
				{canAdd && (
					<Button type="primary" size="small" onClick={onAdd}>
						{addLabel}
					</Button>
				)}
				{canAdd && onAddGroup && (
					<Button type="primary" size="small" onClick={onAddGroup}>
						{langtext("schema_editor.add_group")}
					</Button>
				)}
			</Space>
			{showUsageCount && (
				<Tag
					className={
						isUsageOutOfBounds
							? "schema-group-add-controls__count schema-group-add-controls__count--error"
							: "schema-group-add-controls__count"
					}
					bordered={false}
				>
					{currentUsage} ({minUsage} / {maxUsage})
				</Tag>
			)}
		</span>
	);
};

export default SchemaEditorGroupAddButton;
