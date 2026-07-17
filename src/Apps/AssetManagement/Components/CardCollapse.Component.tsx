/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { ReactNode, useState } from "react";
import { Button } from "antd";
import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import SchemaEditorPathTooltip from "../../../Components/Schema/SchemaEditor/SchemaEditorPathTooltip";

interface CardCollapseProps {
	title: string;
	extraContent?: ReactNode;
	children?: ReactNode;
	actionElement?: ReactNode;
	hasContentError?: boolean;
	hasContentWarning?: boolean;
	depth?: number;
	mstPath?: string;
	mstValue?: unknown;
	schemaPath?: string;
	schemaTypeLabel?: string;
	defaultCollapsed?: boolean;
}

const CardCollapse: React.FC<CardCollapseProps> = ({
	title,
	extraContent,
	children,
	actionElement,
	hasContentError = false,
	hasContentWarning = false,
	depth = 0,
	mstPath,
	mstValue,
	schemaPath,
	schemaTypeLabel,
	defaultCollapsed = false,
}) => {
	const [collapsed, setCollapsed] = useState(defaultCollapsed && !hasContentError);

	const bodyStateClass = hasContentError
		? "card-collapse__body--error"
		: hasContentWarning
			? "card-collapse__body--warning"
			: "";

	const titleContent =
		mstPath || schemaPath !== undefined ? (
			<SchemaEditorPathTooltip
				mstPath={mstPath}
				mstValue={mstValue}
				schemaPath={schemaPath}
				schemaTypeLabel={schemaTypeLabel}
			>
				<span className="card-collapse__title-text">{title}</span>
			</SchemaEditorPathTooltip>
		) : (
			title
		);

	return (
		<div className="card-collapse" data-depth={depth}>
			<div className="card-collapse__header">
				<span className="card-collapse__title">{titleContent}</span>
				<div className="card-collapse__extra">
					{extraContent}
					{actionElement}
					<Button
						type="link"
						className="card-collapse-toggle"
						onClick={() => setCollapsed(!collapsed)}
						icon={collapsed ? <PlusOutlined /> : <MinusOutlined />}
					/>
				</div>
			</div>
			{!collapsed && (
				<div className={`card-collapse__body ${bodyStateClass}`.trim()}>{children}</div>
			)}
		</div>
	);
};

export default CardCollapse;
