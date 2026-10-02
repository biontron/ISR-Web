/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { ReactNode, useState } from "react";
import { Button } from "antd";
import { MinusOutlined, PlusOutlined } from "@ant-design/icons";

interface CardCollapseProps {
	title: ReactNode;
	/** Nur sichtbar, solange der Inhalt eingeklappt ist. */
	summary?: ReactNode;
	extraContent?: ReactNode;
	children?: ReactNode | (() => ReactNode);
	actionElement?: ReactNode;
	hasContentError?: boolean;
	hasContentWarning?: boolean;
	depth?: number;
	defaultCollapsed?: boolean;
	/** +/- ausblenden, z. B. leere Liste im Lesemodus. */
	collapsible?: boolean;
	/** Leeres Element statt +/-. */
	empty?: boolean;
}

function renderCollapseBody(children: CardCollapseProps["children"]): ReactNode {
	if (typeof children === "function") {
		return children();
	}
	return children;
}

const CardCollapse: React.FC<CardCollapseProps> = ({
	title,
	summary,
	extraContent,
	children,
	actionElement,
	hasContentError = false,
	hasContentWarning = false,
	depth = 0,
	defaultCollapsed = false,
	collapsible = true,
	empty = false,
}) => {
	const [collapsed, setCollapsed] = useState(defaultCollapsed && !hasContentError);
	const showBody = collapsible && !collapsed;
	const heading = collapsed && summary != null && summary !== "" ? summary : title;

	const bodyStateClass = hasContentError
		? "card-collapse__body--error"
		: hasContentWarning
			? "card-collapse__body--warning"
			: "";

	return (
		<div className="card-collapse" data-depth={depth} data-empty={empty ? "true" : undefined}>
			<div className="card-collapse__header">
				<span className="card-collapse__title">{heading}</span>
				<div className="card-collapse__extra">
					{extraContent}
					{actionElement}
					{collapsible ? (
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
					) : empty ? (
						<span className="card-collapse__empty" aria-hidden="true" />
					) : null}
				</div>
			</div>
			{showBody && (
				<div className={`card-collapse__body ${bodyStateClass}`.trim()}>
					{renderCollapseBody(children)}
				</div>
			)}
		</div>
	);
};

export default CardCollapse;
