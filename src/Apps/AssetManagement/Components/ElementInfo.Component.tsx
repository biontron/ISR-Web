/*
# SPDX-License-Identifier: GPL-2.0*/

import { Tooltip, Descriptions, DescriptionsProps } from "antd";
import { Fragment } from "react";
import SchemaSvgIcon from "../../../Components/Schema/SchemaSvgIcon";
import { rootStore } from "../../../Stores/Root.Store";
import { ActiveElement, getElementDisplayName, isTreeElement } from "../../../Interfaces/Element";
import { IAsset } from "../../../Stores/Models/Asset.Model";
import {
	resolveElementKindDisplay,
	resolveElementTypeDisplay,
} from "../../../lib/elementDefinitionTypes";

/**
 * Active Container Info
 * //TODO: Definition still pending
 * @param element
 * @returns
 */
export const ElementInfo = ({ element }: { element: ActiveElement }) => {
	const { activeView, activeElement } = rootStore.ui;
	console.log("ElementInfo", element);

	if (!element) {
		return <Fragment>Active Element: Not Available!</Fragment>;
	}

	if (element.class === "Connection") {
		return (
			<Fragment>
				<Tooltip title={getElementDisplayName(element)}>
					<span>{getElementDisplayName(element)}</span>
				</Tooltip>
			</Fragment>
		);
	}

	if (!isTreeElement(element) || !element.definition) {
		return <Fragment>Active Element: No definition?!</Fragment>;
	}

	const infoTitle = "Element Info";

	const schemas = rootStore.configSchemas.schemaCompat;

	// Type Definiton for Ant-design-table. the data is given by ElementTree.Component
	const items: DescriptionsProps["items"] = [
		{
			key: "1",
			label: "Typ",
			children: resolveElementTypeDisplay(element.definition, schemas) || "—",
		},
		{
			key: "2",
			label: "Schema",
			children: element.definition.subType || "—",
		},
		{
			key: "2c",
			label: "baseType",
			children: resolveElementKindDisplay(element.definition, element.class) || "—",
		},
		{
			key: "3",
			label: "Name",
			children: element.definition.name
		},
		{
			key: "4",
			label: "Label",
			children: element.class === "Asset" ? (element as IAsset).definition.label : "—"
		},
		{
			key: "5",
			label: "Descripton",
			children: element.definition.description
		},
		{
			key: "6",
			label: "ID",
			children: <span className="element-info-id-value">{element.id}</span>,
		},
		{
			key: "7",
			label: "Status",
			children: element.status
		},
	];

	return (
		<Fragment>
			{element.definition && (
				<Tooltip
					title={
						<>
							<div className="element-info-title">{infoTitle}</div>
							<Descriptions className="element-info-descriptions" items={items} layout="horizontal" bordered column={1} size="small" />
						</>
					}
					className={(element.id === activeElement?.id) ? "ActiveElement" : ""}
				>
					<div style={{ width: "2em", maxWidth: "2em", height: "1.5em", maxHeight: "2em", display: "inline-block"}}>
						<SchemaSvgIcon
							svgString={rootStore.configSchemas.getIconByDefinition(element?.definition)}
							element={element}
						/>
					</div>
					{element?.definition.name}
				</Tooltip>
			)}
		</Fragment>
	);
};
