/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { Select, Button, Col, Row, Space, Tree, List, message } from "antd";
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
	resolveTreeNodeSegment,
	treeNodeSegmentClassName,
} from "../../../lib/treeNodeDisplay";
import { collectUnlinkedElementsForView, UnlinkedTreeElement } from "../../../lib/treeUnlinkedAssets";
import {
	ancestorIdsFromTreeKey,
	buildElementTreeNodes,
	collectTreeKeysForElementId,
	fillExpandedTreeNodes,
	resolveTreeParentSpec,
	setTreeNodeChildren,
	treeNodeElementId,
} from "../../../lib/elementTreeNodes";
import { resolveElementLiveStatus } from "../../../lib/elementLiveStatus";
import {
	hierarchyAssignmentEpoch,
	hierarchyOwnerEpoch,
} from "../../../lib/hierarchyIndex";
import {
	canDropAssetOnContextComponent,
	resolveContextBind,
} from "../../../lib/connectionContextBind";

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

const TreeNodeTitle = observer(function TreeNodeTitle({
	nodeData,
	marks,
}: {
	nodeData: ITreeNode;
	marks?: ElementMarkFlags;
}) {
	const [tooltipOpen, setTooltipOpen] = React.useState(false);
	const elementId = treeNodeElementId(nodeData);
	const status = resolveElementLiveStatus(rootStore, elementId) ?? nodeData.status;
	const definition = {
		baseType: nodeData.baseType,
		type: nodeData.elementType,
		subType: nodeData.subType,
		storeType: nodeData.storeType,
	};
	const infoTitle = (
		<>
			{nodeData.class ?? "???"} — {nodeData.title ?? "???"}
			<br />
			{nodeData.label ?? "—"}
		</>
	);
	const tooltipItems: DescriptionsProps["items"] = tooltipOpen
		? [
				{
					key: "0",
					label: "Umgebung",
					children: buildTreeNodeInfoRows(rootStore, nodeData, definition)[0]?.value ?? "—",
				},
				{
					key: "1d",
					label: "Type",
					children: resolveElementKindDisplay(definition, nodeData.class) || definition.baseType || "—",
				},
				{ key: "1", label: "Subtype", children: definition.type ?? "—" },
				{ key: "3", label: "Name", children: nodeData.title },
				{ key: "4", label: "Label", children: nodeData.label ?? "—" },
				{ key: "5", label: "Descripton", children: nodeData.description },
				{
					key: "6",
					label: "ID",
					children: <span className="element-info-id-value">{treeNodeElementId(nodeData)}</span>,
				},
				{ key: "7", label: "Status", children: status },
			]
		: [];

	const segment = resolveTreeNodeSegment(definition, nodeData.class);
	const treeNodeClasses = `${treeNodeSegmentClassName(segment)} ${status === "new" || status === "edit" || status === "changed" || status === "invalid" ? "EditMode" : ""} ${rootStore.ui.activeElement?.id === elementId ? "ActiveElement" : ""} ${marks?.searchMatch ? "SearchMatch" : ""}`;

	return (
		<span className={`element-tree-node-title ${treeNodeClasses}`}>&#160;
			<SchemaSvgIcon
				svgString={rootStore.configSchemas.getIconByDefinition(definition)}
				element={{
					class: nodeData.class,
					baseType: nodeData.baseType,
					type: nodeData.elementType,
					subType: nodeData.subType,
					elementType: nodeData.elementType,
				}}
			/>
			<Tooltip
				title={
					tooltipOpen ? (
						<>
							<div className="element-info-title">{infoTitle}</div>
							<Descriptions className="element-info-descriptions" items={tooltipItems} layout="horizontal" bordered column={1} size="small" />
						</>
					) : ""
				}
				onOpenChange={setTooltipOpen}
				getPopupContainer={() => document.body}
			>
				<span>&#160;{nodeData.title ?? "???"}</span>
			</Tooltip>
			<ElementSignalBars
				flags={{
					changed: elementStatusShowsIndicator(status as never) || !!marks?.changed,
					positive: !!marks?.positive,
					negative: !!marks?.negative,
				}}
			/>
		</span>
	);
});

function renderTreeNodeTitle(nodeData: ITreeNode, marks?: ElementMarkFlags) {
	return <TreeNodeTitle nodeData={nodeData} marks={marks} />;
}

const UNLINKED_RENDER_LIMIT = 80;

const ElementHierarchyTree = observer(function ElementHierarchyTree() {
	const view = rootStore.ui.activeView;
	const viewId = view?.id;
	const assignmentEpoch = hierarchyAssignmentEpoch(rootStore.groups.groups);
	const ownerEpoch = hierarchyOwnerEpoch(rootStore.assets.assets);
	const dataEpoch = `${viewId ?? ""}:${rootStore.groups.groups.length}:${rootStore.assets.assets.length}:${assignmentEpoch}:${ownerEpoch}`;
	const [treeData, setTreeData] = React.useState<ITreeNode[]>([]);

	React.useEffect(() => {
		if (!view) {
			setTreeData([]);
			return;
		}
		setTreeData(buildElementTreeNodes(rootStore, view));
	}, [dataEpoch, view]);

	return (
		<ElementHierarchyTreeView
			treeData={treeData}
			viewId={viewId}
			activeElementId={rootStore.ui.activeElement?.id}
			onTreeDataChange={setTreeData}
		/>
	);
});

const ElementHierarchyTreeView = observer(function ElementHierarchyTreeView({
	treeData,
	viewId,
	activeElementId,
	onTreeDataChange,
}: {
	treeData: ITreeNode[];
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

	React.useEffect(() => {
		if (!viewId || treeData.length === 0 || expandedKeys.length === 0) {
			return;
		}
		const filled = fillExpandedTreeNodes(
			rootStore,
			treeData,
			expandedKeys.map(String),
			viewId
		);
		if (filled !== treeData) {
			onTreeDataChange(filled);
		}
	}, [treeData, expandedKeys, viewId, onTreeDataChange]);

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

	function onDrop(info: { dragNode: ITreeNode; node: ITreeNode }) {
		const dragId = treeNodeElementId(info.dragNode);
		const dropId = treeNodeElementId(info.node);
		const dragAsset = resolveIdentifier(AssetModel, rootStore, dragId);
		const dropAsset = resolveIdentifier(AssetModel, rootStore, dropId);
		const assets = rootStore.assets.assets;
		if (!canDropAssetOnContextComponent(dragAsset, dropAsset, assets) || !dragAsset || !dropAsset) {
			return;
		}
		const resolution = resolveContextBind(dragAsset, dropAsset);
		if (resolution.status === "ready") {
			try {
				rootStore.connections.createContextConnection(resolution.choice);
				message.success(rootStore.i18n.text("general.connection_context_created"));
			} catch (error) {
				message.error(error instanceof Error ? error.message : String(error));
			}
			return;
		}
		if (resolution.status === "needs-choice") {
			rootStore.ui.setPendingContextBind(dropAsset.id, resolution.fromDockpartId);
			message.info(rootStore.i18n.text("general.connection_drop_needs_choice"));
			navigateToElement(navigate, dragAsset.id);
			return;
		}
		if (resolution.status === "no-dockpart") {
			message.error(rootStore.i18n.text("general.connection_drop_no_dockpart"));
			return;
		}
		message.error(rootStore.i18n.text("general.connection_drop_no_value"));
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

	if (treeData.length === 0) {
		return <div className="element-tree-loading">…</div>;
	}

	return (
		<div className="element-tree-hierarchy" tabIndex={0}>
			<Tree
				checkable={false}
				selectable
				draggable={{
					icon: false,
					nodeDraggable: (node) => (node as ITreeNode).class === "Asset",
				}}
				allowDrop={({ dragNode, dropNode }) => {
					const dropId = treeNodeElementId(dropNode as ITreeNode);
					const dragId = treeNodeElementId(dragNode as ITreeNode);
					const dropAsset = resolveIdentifier(AssetModel, rootStore, dropId);
					const dragAsset = resolveIdentifier(AssetModel, rootStore, dragId);
					return canDropAssetOnContextComponent(
						dragAsset,
						dropAsset,
						rootStore.assets.assets
					);
				}}
				onDrop={onDrop}
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

	const visibleUnlinked = unlinkedElements.slice(0, UNLINKED_RENDER_LIMIT);

	return (
		<div className="element-tree-unlinked">
			<div className="element-tree-unlinked__title">
				{langtext("general.tree_unlinked_components")}
				{unlinkedElements.length > 0 ? ` (${unlinkedElements.length})` : ""}
			</div>
			<div className="element-tree-unlinked__panel">
				<List
					size="small"
					locale={{ emptyText: "—" }}
					dataSource={visibleUnlinked}
					renderItem={(element) => (
						<List.Item
							className={`element-tree-unlinked-item ${selectedId === element.id ? "element-tree-unlinked-item--selected" : ""}`}
							onClick={() => navigateToElement(navigate, element.id)}
						>
							{renderTreeNodeTitle(elementToTreeNode(element), marks.get(element.id))}
						</List.Item>
					)}
				/>
				{unlinkedElements.length > UNLINKED_RENDER_LIMIT ? (
					<div className="element-tree-unlinked__more">
						{langtext("general.tree_unlinked_showing_limited", {
							shown: UNLINKED_RENDER_LIMIT,
							total: unlinkedElements.length,
						})}
					</div>
				) : null}
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
