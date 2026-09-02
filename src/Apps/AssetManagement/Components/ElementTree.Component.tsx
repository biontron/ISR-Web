/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { Select, Button, Col, Row, Tree, List } from "antd";
import { observer } from "mobx-react";
import { resolveIdentifier } from "mobx-state-tree";
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

function navigateToElement(navigate: ReturnType<typeof useNavigate>, elementId: string) {
	navigate(`/${authStore.getDomain()}/am/${rootStore.ui.activeView?.id}/element/${elementId}`);
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

function renderTreeNodeTitle(nodeData: ITreeNode) {
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

	const items: DescriptionsProps["items"] = [
		{ key: "0", label: "storeType", children: definition?.storeType ?? "—" },
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
		{ key: "1b", label: "Subtyp", children: definition?.subType ?? "—" },
		{ key: "3", label: "Name", children: nodeData.title },
		{ key: "4", label: "Label", children: nodeData.label ?? "—" },
		{ key: "5", label: "Descripton", children: nodeData.description },
		{
			key: "6",
			label: "ID",
			children: <span className="element-info-id-value">{nodeData.key}</span>,
		},
		{ key: "7", label: "Status", children: nodeData.status },
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

const ElementHierarchyTree = observer(function ElementHierarchyTree() {
	const treeData = rootStore.ui.activeView?.childrenAsTreeNodes();
	return <ElementHierarchyTreeView treeData={treeData} />;
});

const ElementHierarchyTreeView = observer(function ElementHierarchyTreeView({
	treeData,
}: {
	treeData: ITreeNode[] | undefined;
}) {
	const navigate = useNavigate();
	const selectedKeys = rootStore.ui.activeElement?.id ? [rootStore.ui.activeElement.id] : [];

	function onSelect(nextKeys: React.Key[]) {
		if (!nextKeys?.length) {
			return;
		}
		const elementId = String(nextKeys[0]);
		if (resolveIdentifier(GroupModel, rootStore, elementId) || resolveIdentifier(AssetModel, rootStore, elementId)) {
			navigateToElement(navigate, elementId);
		}
	}

	return (
		<Tree
			autoExpandParent
			checkable={false}
			selectable
			defaultExpandAll
			showLine
			showIcon
			treeData={treeData}
			onSelect={onSelect}
			titleRender={renderTreeNodeTitle}
			selectedKeys={selectedKeys}
		/>
	);
});

const ElementUnlinkedList = observer(function ElementUnlinkedList() {
	const unlinkedElements = collectUnlinkedElementsForView(rootStore, rootStore.ui.activeView?.id);
	return <ElementUnlinkedListView unlinkedElements={unlinkedElements} />;
});

const ElementUnlinkedListView = observer(function ElementUnlinkedListView({
	unlinkedElements,
}: {
	unlinkedElements: UnlinkedTreeElement[];
}) {
	const langtext = useLangtext();
	const navigate = useNavigate();
	const selectedId = rootStore.ui.activeElement?.id;

	return (
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
							className={`element-tree-unlinked-item ${selectedId === element.id ? "element-tree-unlinked-item--selected" : ""}`}
							onClick={() => navigateToElement(navigate, element.id)}
						>
							{renderTreeNodeTitle(elementToTreeNode(element))}
						</List.Item>
					)}
				/>
			</div>
		</div>
	);
});

type Props = {};

export const ElementTree = observer((props: Props) => {
	const { activeElement } = rootStore.ui;
	const navigate = useNavigate();
	const viewClasses = `${activeElement?.status === "new" || activeElement?.status === "edit" || activeElement?.status === "changed" || activeElement?.status === "invalid" ? "EditMode" : ""} ${rootStore.ui.activeView?.id === activeElement?.id ? "ActiveElement" : ""}`;

	return (
		<div className="element-tree">
			<div className="element-tree__scroll">
			<Row gutter={[16, 16]}>
				<Col span={24}>
					<ElementStatusDot status={rootStore.ui.activeView?.status} />
					<Select
						labelInValue
						defaultValue={{ value: rootStore.ui.activeView?.id }}
						value={{ value: rootStore.ui.activeView?.id }}
						style={{ width: 300 }}
						className={viewClasses}
						onChange={(val) => {
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
						onClick={() => {
							navigate(`/${authStore.getDomain()}/am/${rootStore.ui.activeView?.id}`);
						}}
						icon={<VerticalAlignBottomOutlined />}
						shape="circle"/>
				</Col>
				<Col span={24}>
					<ElementHierarchyTree />
				</Col>
			</Row>
			</div>
			<ElementUnlinkedList />
		</div>
	);
});
