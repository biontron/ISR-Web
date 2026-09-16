import React from "react";
import { Descriptions, Tooltip } from "antd";
import type { DescriptionsProps } from "antd";
import {
	buildElementDefinitionHoverRows,
	elementDefinitionHoverTitle,
	type ElementDefinitionHoverFields,
} from "../../lib/elementDefinitionHover";

export function ElementDefinitionHoverContent({
	fields,
}: {
	fields: ElementDefinitionHoverFields;
}) {
	const titleLines = elementDefinitionHoverTitle(fields).split("\n");
	const items: DescriptionsProps["items"] = buildElementDefinitionHoverRows(fields).map(
		(row, index) => ({
			key: String(index),
			label: row.label,
			children: row.label === "ID" ? <span className="element-info-id-value">{row.value}</span> : row.value,
		})
	);

	return (
		<>
			<div className="element-info-title">
				{titleLines[0]}
				{titleLines[1] ? (
					<>
						<br />
						{titleLines[1]}
					</>
				) : null}
			</div>
			<Descriptions
				className="element-info-descriptions"
				items={items}
				layout="horizontal"
				bordered
				column={1}
				size="small"
			/>
		</>
	);
}

const ElementDefinitionHoverTooltip: React.FC<{
	fields: ElementDefinitionHoverFields;
	children: React.ReactNode;
}> = ({ fields, children }) => {
	return (
		<Tooltip
			title={<ElementDefinitionHoverContent fields={fields} />}
			placement="right"
			mouseEnterDelay={0.2}
			overlayClassName="element-definition-hover-overlay"
			getPopupContainer={() => document.body}
		>
			<span className="element-definition-hover-target">
				{children}
			</span>
		</Tooltip>
	);
};

export default ElementDefinitionHoverTooltip;
