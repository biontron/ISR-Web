/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { Select, Button, Col, Row, Tree, List } from "antd";
import { observer } from "mobx-react";
import { resolveIdentifier } from "mobx-state-tree";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import authStore from "../../../Stores/Auth.Store";
import { AssetModel } from "../../../Stores/Models/Asset.Model";
import { IView } from "../../../Stores/Models/View.Model";
import { GroupModel } from "../../../Stores/Models/Group.Model";
import { rootStore } from "../../../Stores/Root.Store";
import { ITreeNode } from "../../../Interfaces/Tree";
import React from "react";
import SchemaSvgIcon from "../../../Components/Schema/SchemaSvgIcon";
import ElementStatusDot from "../../../Components/ChangeMode/ElementStatusDot";
import { Tooltip, Descriptions, DescriptionsProps } from "antd";
import { VerticalAlignBottomOutlined } from "@ant-design/icons";
import {
	resolveElementKindDisplay,
	resolveElementTypeDisplay,
} from "../../../lib/elementDefinitionTypes";
import { useLangtext } from "../../../lib/common";
import {
	resolveTreeElement,
	resolveTreeNodeDefinition,
	resolveTreeNodeSegment,
	treeNodeSegmentClassName,
} from "../../../lib/treeNodeDisplay";
import { collectUnlinkedElementsForView, UnlinkedTreeElement } from "../../../lib/treeUnlinkedAssets";


type Props = {};

export const ElementTree = observer((props: Props) => {
	const langtext = useLangtext();
	const { activeView, activeElement } = rootStore.ui;
	const [openEditDialog, setOpenEditDialog] = useState(false);
	const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

	const navigate = useNavigate();

	/**
	 * update selectedKeys to reflect aktiveElement
	 */
	useEffect(() => {
		if (activeElement) {
			setSelectedKeys([activeElement.id]);
		}
	}, [activeElement]);

	function navigateToElement(elementId: string) {
		navigate(`/${authStore.getDomain()}/am/${rootStore.ui.activeView?.id}/element/${elementId}`);
	}

	function onSelect(selectedKeys: any, info: any) {
		if (selectedKeys?.length) {
			if (selectedKeys.length === 0) {
				return;
			}
			setSelectedKeys(selectedKeys);

			const group = resolveIdentifier(GroupModel, rootStore, selectedKeys[0]);
			if (group) {
				navigateToElement(selectedKeys[0]);
				return;
			}

			const asset = resolveIdentifier(AssetModel, rootStore, selectedKeys[0]);
			if (asset) {
				navigateToElement(selectedKeys[0]);
			}
		}
	}

	function elementToTreeNode(element: UnlinkedTreeElement): ITreeNode {
		const definition = element.definition;
		return {
			key: element.id,
			class: element.class,
			title: definition?.name,
			storeType: definition?.storeType,
			baseType: definition?.baseType,
			subType: definition?.subType,
			elementType: definition?.type,
			description: definition?.description,
			label: definition && "label" in definition ? String(definition.label ?? "") : "",
			status: element.status,
		};
	}

	/**
	 * Render of a tree node item
	 * @param nodeData
	 * @returns a tree node
	 */
	function renderNodeTitle(nodeData: ITreeNode) {
		const definition = resolveTreeNodeDefinition(rootStore, nodeData);
		const treeElement = resolveTreeElement(rootStore, nodeData);
		const iconElement = treeElement ?? nodeData;
		const schemas = rootStore.configSchemas.schemaCompat;

		const infoTitle = (
			<>
				{nodeData.class ?? "???"} — {nodeData.title ?? "???"}
				<br />
				{nodeData.label ?? "—"}
			</>
		);

		// Type Definiton for Ant-design-table. the structure is given by ElementInfo.Component

		const items: DescriptionsProps["items"] = [
			{
				key: "0",
				label: "storeType",
				children: definition?.storeType ?? "—",
			},
			{
				key: "1d",
				label: "baseType",
				children: resolveElementKindDisplay(definition, nodeData.class) || "—",
			},
			{
				key: "1",
				label: "Typ",
				children: resolveElementTypeDisplay(definition, schemas) || "—",
			},
			{
				key: "1b",
				label: "Subtyp",
				children: definition?.subType ?? "—",
			},
			{
				key: "3",
				label: "Name",
				children: nodeData.title
			},
			{
				key: "4",
				label: "Label",
				children: nodeData.label ?? "—"
			},
			{
				key: "5",
				label: "Descripton",
				children: nodeData.description
			},
			{
				key: "6",
				label: "ID",
				children: <span className="element-info-id-value">{nodeData.key}</span>,
			},
			{
				key: "7",
				label: "Status",
				children: nodeData.status
			},
		];

		const segment = resolveTreeNodeSegment(definition, nodeData.class);
		const treeNodeClasses = `${treeNodeSegmentClassName(segment)} ${nodeData?.status === "new" || nodeData?.status === "edit" || nodeData?.status === "changed" || nodeData?.status === "invalid" ? "EditMode" : ""} ${rootStore.ui.activeElement?.id === nodeData?.key ? "ActiveElement" : ""}`;

		return (
			<span className={treeNodeClasses}>&#160;
				<SchemaSvgIcon
					svgString={rootStore.configSchemas.getIconByDefinition(definition)}
					element={iconElement}
				/>
				<Tooltip
					title={
						<>
							<div className="element-info-title">{infoTitle}</div>
							<Descriptions className="element-info-descriptions" items={items} layout="horizontal" bordered column={1} size="small" />
						</>
					}
					getPopupContainer={() => document.body}
				>
					<span>&#160;{nodeData.title ?? "???"}</span>
				</Tooltip>
				<ElementStatusDot status={nodeData.status} />
			</span>
		  );
	}

	const viewClasses = `${activeElement?.status === "new" || activeElement?.status === "edit" || activeElement?.status === "changed" || activeElement?.status === "invalid" ? "EditMode" : ""} ${rootStore.ui.activeView?.id === activeElement?.id ? "ActiveElement" : ""}`;

	const unlinkedElements = collectUnlinkedElementsForView(rootStore, activeView?.id);

	return (
		<div className="element-tree">
			<div className="element-tree__scroll">
			{/* <ContainerEditDialog open={openEditDialog} setOpen={setOpenEditDialog} /> */}
			<Row gutter={[16, 16]}>
				<Col span={24}>
					{/* rootStore.ui.activeGroup != null && <Button type="primary" icon={<EditOutlined />} onClick={() => setOpenEditDialog(true)} /> */}
					{/* onClick="{rootStore.ui.setActiveGroupById(undefined)}" */}
					<ElementStatusDot status={rootStore.ui.activeView?.status} />
					<Select
						labelInValue
						defaultValue={{ value: rootStore.ui.activeView?.id }}
						value={{ value: rootStore.ui.activeView?.id }}
						style={{ width: 300 }}
						className={viewClasses}
						onChange={(val) => {
							// rootStore.ui.setActiveView(val.value as any);
							navigate(`/${authStore.getDomain()}/am/${val.value}`);
						}}
						options={rootStore.views.views.map((view: IView) => {
							return {
								value: view.id,
								label: (
									<span className="element-tree-view-option">
										<ElementStatusDot status={view.status} />
										{view.definition.name}
									</span>
								),
							};
						})}
					/>
					<Button
						onClick={(val) => {
							// rootStore.ui.setActiveView(val.value as any);
							navigate(`/${authStore.getDomain()}/am/${rootStore.ui.activeView?.id}`);
						}}
						icon={<VerticalAlignBottomOutlined />}
						shape="circle"/>
				</Col>
				<Col span={24}>
					<Tree
						// className="draggable-tree"
						// multiple
						autoExpandParent
						checkable={false}
						selectable
						defaultExpandAll
						// draggable
						showLine
						showIcon
						// blockNode
						treeData={rootStore.ui.activeView?.childrenAsTreeNodes()}
						onSelect={onSelect}
						titleRender={renderNodeTitle}
						selectedKeys={selectedKeys}
						// defaultExpandedKeys={rootStore.ui.activeView?.childrenAsTreeNodes().map((node: ITreeNode) => node.key)}
						// defaultExpandedKeys={["abc","xyz"]}
					/>
				</Col>
			</Row>
			</div>
			<div className="element-tree-unlinked">
				<div className="element-tree-unlinked__title">
					{langtext("general.tree_unlinked_components")}
				</div>
				<div className="element-tree-unlinked__panel">
					<List
						size="small"
						locale={{ emptyText: "—" }}
						dataSource={unlinkedElements}
						renderItem={(element) => (
							<List.Item
								className={`element-tree-unlinked-item ${selectedKeys.includes(element.id) ? "element-tree-unlinked-item--selected" : ""}`}
								onClick={() => {
									setSelectedKeys([element.id]);
									navigateToElement(element.id);
								}}
							>
								{renderNodeTitle(elementToTreeNode(element))}
							</List.Item>
						)}
					/>
				</div>
			</div>
		</div>
	);
});
