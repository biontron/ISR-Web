/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { Select, Button, Col, Row, Space, Tree, List } from "antd";
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
import ElementSignalBars from "../../../Components/ChangeMode/ElementSignalBars";
import { elementStatusShowsIndicator } from "../../../lib/elementStatusStyle";
import type { ElementMarkFlags } from "../../../lib/elementXPathValidation";
import { Tooltip, Descriptions, DescriptionsProps } from "antd";
import { VerticalAlignBottomOutlined } from "@ant-design/icons";
import { resolveElementKindDisplay } from "../../../lib/elementDefinitionTypes";
import { useLangtext } from "../../../lib/common";
import {
	buildTreeNodeInfoRows,
	resolveTreeElement,
	resolveTreeNodeDefinition,
	resolveTreeNodeSegment,
	treeNodeSegmentClassName,
} from "../../../lib/treeNodeDisplay";
import { collectUnlinkedElementsForView, UnlinkedTreeElement } from "../../../lib/treeUnlinkedAssets";
import {
	ancestorIdsFromTreeKey,
	buildElementTreeNodes,
	collectTreeKeysForElementId,
	resolveTreeParentSpec,
	setTreeNodeChildren,
	treeNodeElementId,
} from "../../../lib/elementTreeNodes";
import { filterRuleExpression } from "../../../lib/filterRuleNormalize";

function viewIdFromSelectValue(val: unknown): string | undefined {
	if (typeof val === "string" && val.trim() !== "") {
		return val;
	}
	if (val && typeof val === "object" && "value" in val) {
		const value = (val as { value?: unknown }).value;
		if (typeof value === "string" && value.trim() !== "") {
			return value;
		}
	}
	return undefined;
}

function navigateToElement(navigate: ReturnType<typeof useNavigate>, elementId: string) {
	navigate(`/${authStore.getDomain()}/am/${rootStore.ui.activeView?.id}/element/${elementId}`);
}

function flattenVisibleTreeNodes(nodes: ITreeNode[], expandedKeys: React.Key[]): ITreeNode[] {
	const expanded = new Set(expandedKeys.map(String));
	const visible: ITreeNode[] = [];
	const walk = (list: ITreeNode[]) => {
		for (const node of list) {
			visible.push(node);
			if (node.children?.length && expanded.has(String(node.key))) {
				walk(node.children);
			}
		}
	};
	walk(nodes);
	return visible;
}

function isKeyboardTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	if (target.isContentEditable) {
		return true;
	}
	return Boolean(target.closest("input, textarea, select, [contenteditable='true'], .ant-modal, .ant-dropdown"));
}

function elementToTreeNode(element: UnlinkedTreeElement): ITreeNode {
	const definition = element.definition;
	return {
		key: element.id,
		elementId: element.id,
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

function renderTreeNodeTitle(nodeData: ITreeNode, marks?: ElementMarkFlags) {
	const definition = resolveTreeNodeDefinition(rootStore, nodeData);
	const treeElement = resolveTreeElement(rootStore, nodeData);
	const iconElement = treeElement ?? nodeData;
	const infoTitle = (
		<>
			{nodeData.class ?? "???"} — {nodeData.title ?? "???"}
			<br />
			{nodeData.label ?? "—"}
		</>
	);

	const items: DescriptionsProps["items"] = [
		{ key: "0", label: "Umgebung", children: buildTreeNodeInfoRows(rootStore, nodeData, definition)[0]?.value ?? "—" },
		{
			key: "1d",
			label: "Type",
			children: resolveElementKindDisplay(definition, nodeData.class) || definition?.baseType || "—",
		},
		{
			key: "1",
			label: "Subtype",
			children: definition?.type ?? "—",
		},
		{ key: "3", label: "Name", children: nodeData.title },
		{ key: "4", label: "Label", children: nodeData.label ?? "—" },
		{ key: "5", label: "Descripton", children: nodeData.description },
		{
			key: "6",
			label: "ID",
			children: <span className="element-info-id-value">{treeNodeElementId(nodeData)}</span>,
		},
		{ key: "7", label: "Status", children: nodeData.status },
	];

	const segment = resolveTreeNodeSegment(definition, nodeData.class);
	const elementId = treeNodeElementId(nodeData);
	const resolvedMarks = marks ?? rootStore.ui.elementMarks.get(elementId);
	const treeNodeClasses = `${treeNodeSegmentClassName(segment)} ${nodeData?.status === "new" || nodeData?.status === "edit" || nodeData?.status === "changed" || nodeData?.status === "invalid" ? "EditMode" : ""} ${rootStore.ui.activeElement?.id === elementId ? "ActiveElement" : ""} ${resolvedMarks?.searchMatch ? "SearchMatch" : ""}`;

	return (
		<span className={`element-tree-node-title ${treeNodeClasses}`}>&#160;
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
			<ElementSignalBars
				flags={{
					changed: elementStatusShowsIndicator(nodeData.status as never) || !!resolvedMarks?.changed,
					positive: !!resolvedMarks?.positive,
					negative: !!resolvedMarks?.negative,
				}}
			/>
		</span>
	);
}

const ElementHierarchyTree = observer(function ElementHierarchyTree() {
	const view = rootStore.ui.activeView;
	const viewId = view?.id;
	const filterSig = view
		? Array.from(view.filterRules ?? [])
				.map((rule) => filterRuleExpression(rule))
				.join("|")
		: "";
	const dataEpoch = `${viewId ?? ""}:${rootStore.groups.groups.length}:${rootStore.assets.assets.length}:${filterSig}`;
	const [treeData, setTreeData] = React.useState<ITreeNode[]>([]);
	const [building, setBuilding] = React.useState(false);

	React.useEffect(() => {
		if (!view) {
			setTreeData([]);
			setBuilding(false);
			return;
		}
		setBuilding(true);
		setTreeData([]);
		const timer = window.setTimeout(() => {
			setTreeData(buildElementTreeNodes(rootStore, view));
			setBuilding(false);
		}, 0);
		return () => window.clearTimeout(timer);
	}, [dataEpoch, view]);

	return (
		<ElementHierarchyTreeView
			treeData={treeData}
			building={building}
			viewId={viewId}
			activeElementId={rootStore.ui.activeElement?.id}
			onTreeDataChange={setTreeData}
		/>
	);
});

const ElementHierarchyTreeView = observer(function ElementHierarchyTreeView({
	treeData,
	building,
	viewId,
	activeElementId,
	onTreeDataChange,
}: {
	treeData: ITreeNode[];
	building: boolean;
	viewId?: string;
	activeElementId?: string;
	onTreeDataChange: React.Dispatch<React.SetStateAction<ITreeNode[]>>;
}) {
	const navigate = useNavigate();
	const marks = treeData.length > 0 ? rootStore.ui.elementMarks : undefined;
	const selectedKeys = activeElementId ? collectTreeKeysForElementId(treeData, activeElementId) : [];
	const [expandedKeys, setExpandedKeys] = React.useState<React.Key[]>([]);

	React.useEffect(() => {
		setExpandedKeys([]);
	}, [viewId]);

	function activateTreeNode(node: ITreeNode) {
		const elementId = treeNodeElementId(node);
		if (resolveIdentifier(GroupModel, rootStore, elementId) || resolveIdentifier(AssetModel, rootStore, elementId)) {
			navigateToElement(navigate, elementId);
		}
	}

	function onSelect(nextKeys: React.Key[], info: { node: ITreeNode }) {
		if (!nextKeys?.length) {
			return;
		}
		activateTreeNode(info.node);
	}

	React.useEffect(() => {
		const handleTreeKeys = (event: KeyboardEvent) => {
			if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
				return;
			}
			if (isKeyboardTypingTarget(event.target)) {
				return;
			}
			const visible = flattenVisibleTreeNodes(treeData, expandedKeys);
			if (visible.length === 0) {
				return;
			}
			const selectedKey = selectedKeys[0];
			let index = selectedKey != null
				? visible.findIndex((node) => String(node.key) === String(selectedKey))
				: -1;
			if (index < 0 && activeElementId) {
				index = visible.findIndex((node) => treeNodeElementId(node) === activeElementId);
			}
			const nextIndex = event.key === "ArrowDown"
				? (index < 0 ? 0 : Math.min(visible.length - 1, index + 1))
				: (index < 0 ? visible.length - 1 : Math.max(0, index - 1));
			if (nextIndex === index) {
				return;
			}
			event.preventDefault();
			activateTreeNode(visible[nextIndex]);
			window.requestAnimationFrame(() => {
				document.querySelector(".element-tree-hierarchy .ant-tree-node-selected")
					?.scrollIntoView({ block: "nearest" });
			});
		};
		window.addEventListener("keydown", handleTreeKeys);
		return () => window.removeEventListener("keydown", handleTreeKeys);
	}, [treeData, expandedKeys, selectedKeys, activeElementId, navigate]);

	function loadChildren(node: ITreeNode) {
		return new Promise<void>((resolve) => {
			if (node.children?.length || node.isLeaf) {
				resolve();
				return;
			}
			const elementId = treeNodeElementId(node);
			const parent = resolveTreeParentSpec(rootStore, elementId);
			if (!parent) {
				resolve();
				return;
			}
			const ancestorIds = ancestorIdsFromTreeKey(String(node.key), viewId);
			ancestorIds.add(elementId);
			const children = buildElementTreeNodes(rootStore, parent, {
				parentKey: String(node.key),
				ancestorIds,
			});
			onTreeDataChange((current) => setTreeNodeChildren(current, String(node.key), children));
			resolve();
		});
	}

	if (building) {
		return <div className="element-tree-loading">…</div>;
	}

	return (
		<div className="element-tree-hierarchy" tabIndex={0}>
			<Tree
				checkable={false}
				selectable
				showLine
				showIcon
				treeData={treeData}
				expandedKeys={expandedKeys}
				onExpand={(keys) => setExpandedKeys(keys)}
				loadData={loadChildren}
				onSelect={onSelect}
				titleRender={(node) =>
					renderTreeNodeTitle(node, marks?.get(treeNodeElementId(node)))
				}
				selectedKeys={selectedKeys}
			/>
		</div>
	);
});

const ElementUnlinkedList = observer(function ElementUnlinkedList() {
	const viewId = rootStore.ui.activeView?.id;
	const [unlinkedElements, setUnlinkedElements] = React.useState<UnlinkedTreeElement[]>([]);

	React.useEffect(() => {
		if (!viewId) {
			setUnlinkedElements([]);
			return;
		}
		const timer = window.setTimeout(() => {
			setUnlinkedElements(collectUnlinkedElementsForView(rootStore, viewId));
		}, 0);
		return () => window.clearTimeout(timer);
	}, [viewId, rootStore.groups.groups.length, rootStore.assets.assets.length]);

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
	const marks = rootStore.ui.elementMarks;

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
							{renderTreeNodeTitle(elementToTreeNode(element), marks.get(element.id))}
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
	const langtext = useLangtext();
	const viewClasses = `${activeElement?.status === "new" || activeElement?.status === "edit" || activeElement?.status === "changed" || activeElement?.status === "invalid" ? "EditMode" : ""} ${rootStore.ui.activeView?.id === activeElement?.id ? "ActiveElement" : ""}`;

	return (
		<div className="element-tree">
			<div className="element-tree__scroll">
			<Row gutter={[16, 16]}>
				<Col span={24}>
					<div className="element-tree-view-select-row">
						<ElementStatusDot status={rootStore.ui.activeView?.status} />
						<Space.Compact className="element-tree-view-select-group">
							<Select
								placeholder={langtext("general.view_picker_title")}
								value={rootStore.ui.activeView?.id}
								className={`element-tree-view-select ${viewClasses}`}
								onChange={(viewId) => {
									const id = viewIdFromSelectValue(viewId);
									if (!id) {
										return;
									}
									navigate(`/${authStore.getDomain()}/am/${id}`);
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
									if (!rootStore.ui.activeView?.id) {
										return;
									}
									navigate(`/${authStore.getDomain()}/am/${rootStore.ui.activeView.id}`);
								}}
								disabled={!rootStore.ui.activeView?.id}
								icon={<VerticalAlignBottomOutlined />}
							/>
						</Space.Compact>
					</div>
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
