/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { ReactNode, useState } from "react";
import { Button } from "antd";
import { MinusOutlined, PlusOutlined } from "@ant-design/icons";

interface CardCollapseProps {
	title: ReactNode;
	extraContent?: ReactNode;
	children?: ReactNode | (() => ReactNode);
	actionElement?: ReactNode;
	hasContentError?: boolean;
	hasContentWarning?: boolean;
	depth?: number;
	defaultCollapsed?: boolean;
}

function renderCollapseBody(children: CardCollapseProps["children"]): ReactNode {
	if (typeof children === "function") {
		return children();
	}
	return children;
}

const CardCollapse: React.FC<CardCollapseProps> = ({
	title,
	extraContent,
	children,
	actionElement,
	hasContentError = false,
	hasContentWarning = false,
	depth = 0,
	defaultCollapsed = false,
}) => {
	const [collapsed, setCollapsed] = useState(defaultCollapsed && !hasContentError);

	const bodyStateClass = hasContentError
		? "card-collapse__body--error"
		: hasContentWarning
			? "card-collapse__body--warning"
			: "";

	return (
		<div className="card-collapse" data-depth={depth}>
			<div className="card-collapse__header">
				<span className="card-collapse__title">{title}</span>
				<div className="card-collapse__extra">
					{extraContent}
					{actionElement}
					<Button
						type="link"
						className="card-collapse-toggle"
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							setCollapsed((current) => !current);
						}}
						icon={collapsed ? <PlusOutlined /> : <MinusOutlined />}
					/>
				</div>
			</div>
			{!collapsed && (
				<div className={`card-collapse__body ${bodyStateClass}`.trim()}>
					{renderCollapseBody(children)}
				</div>
			)}
		</div>
	);
};

export default CardCollapse;
