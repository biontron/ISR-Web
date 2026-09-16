/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { Select, Button, Col, Row, Space, Tree, message } from "antd";
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
import { VerticalAlignBottomOutlined } from "@ant-design/icons";
import { useLangtext } from "../../../lib/common";
import {
	buildTreeNodeInfoRows,
	resolveTreeNodeSegment,
	treeNodeSegmentClassName,
} from "../../../lib/treeNodeDisplay";
import ElementDefinitionHoverTooltip from "../../../Components/Schema/ElementDefinitionHoverTooltip";
import { hoverFieldsFromLiveElement } from "../../../lib/elementDefinitionHover";
import { collectUnlinkedElementForestForView, countUnlinkedElementNodes, UnlinkedElementNode, UnlinkedTreeElement } from "../../../lib/treeUnlinkedAssets";
import {
	ancestorIdsFromTreeKey,
	buildElementTreeNodes,
	collectAncestorKeysForElement,
	collectTreeExpandKeysForElement,
	collectTreeKeysForElementId,
	fillExpandedTreeNodes,
	resolveTreeParentSpec,
	setTreeNodeChildren,
	treeNodeElementId,
	uniqueTreeKeys,
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

function scrollSelectedTreeNodeIntoView() {
	document
		.querySelector(".element-tree-hierarchy .ant-tree-node-selected")
		?.scrollIntoView({ block: "nearest", inline: "nearest" });
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

function unlinkedForestToTreeNodes(nodes: UnlinkedElementNode[]): ITreeNode[] {
	return nodes.map((node) => {
		const children = unlinkedForestToTreeNodes(node.children);
		return {
			...elementToTreeNode(node.element),
			children,
			isLeaf: children.length === 0,
		};
	});
}

function collectExpandableUnlinkedKeys(nodes: ITreeNode[]): React.Key[] {
	const keys: React.Key[] = [];
	const walk = (list: ITreeNode[]) => {
		for (const node of list) {
			if (node.children?.length) {
				keys.push(node.key);
				walk(node.children);
			}
		}
	};
	walk(nodes);
	return keys;
}

function suppressNativeTreeTitle(node: HTMLElement | null) {
	if (!node) {
		return;
	}
	node.removeAttribute("title");
	node.closest(".ant-tree-title")?.removeAttribute("title");
	node.closest(".ant-tree-node-content-wrapper")?.removeAttribute("title");
	node.querySelectorAll(".ant-tree-title[title], .ant-tree-node-content-wrapper[title]").forEach((el) => {
		el.removeAttribute("title");
	});
}

const TreeNodeTitle = observer(function TreeNodeTitle({
	nodeData,
	marks,
}: {
	nodeData: ITreeNode;
	marks?: ElementMarkFlags;
}) {
	const hoverTargetRef = React.useRef<HTMLSpanElement>(null);
	const elementId = treeNodeElementId(nodeData);
	const status = resolveElementLiveStatus(rootStore, elementId) ?? nodeData.status;
	const definition = {
		baseType: nodeData.baseType,
		type: nodeData.elementType,
		subType: nodeData.subType,
		storeType: nodeData.storeType,
	};
	const environment = buildTreeNodeInfoRows(rootStore, nodeData, definition)[0]?.value;
	const displayName = typeof nodeData.title === "string" ? nodeData.title : "";
	const hoverFields = hoverFieldsFromLiveElement(
		{
			id: elementId,
			class: nodeData.class,
			status,
			definition: {
				baseType: nodeData.baseType,
				type: nodeData.elementType,
				subType: nodeData.subType,
				name: displayName,
				label: nodeData.label,
				description: nodeData.description,
			},
		},
		{ environment: environment && environment !== "—" ? environment : undefined }
	);

	React.useLayoutEffect(() => {
		suppressNativeTreeTitle(hoverTargetRef.current);
	});

	const segment = resolveTreeNodeSegment(definition, nodeData.class);
	const treeNodeClasses = `${treeNodeSegmentClassName(segment)} ${status === "new" || status === "edit" || status === "changed" || status === "invalid" ? "EditMode" : ""} ${rootStore.ui.activeElement?.id === elementId ? "ActiveElement" : ""} ${marks?.searchMatch ? "SearchMatch" : ""}`;

	return (
		<ElementDefinitionHoverTooltip fields={hoverFields}>
			<span
				ref={hoverTargetRef}
				className={`element-tree-node-title ${treeNodeClasses}`}
			>
				&#160;
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
				<span>&#160;{displayName || "???"}</span>
				<ElementSignalBars
					flags={{
						changed: elementStatusShowsIndicator(status as never) || !!marks?.changed,
						positive: !!marks?.positive,
						negative: !!marks?.negative,
					}}
				/>
			</span>
		</ElementDefinitionHoverTooltip>
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

	React.useEffect(() => {
		if (!viewId || !activeElementId || treeData.length === 0 || activeElementId === viewId) {
			return;
		}
		const needed = uniqueTreeKeys([
			...collectAncestorKeysForElement(treeData, activeElementId),
			...collectTreeExpandKeysForElement(rootStore, viewId, activeElementId),
		]);
		if (needed.length > 0) {
			setExpandedKeys((current) => {
				const have = new Set(current.map(String));
				if (needed.every((key) => have.has(key))) {
					return current;
				}
				return uniqueTreeKeys([...current.map(String), ...needed]);
			});
		}
		if (collectTreeKeysForElementId(treeData, activeElementId).length === 0) {
			return;
		}
		const frame = window.requestAnimationFrame(scrollSelectedTreeNodeIntoView);
		return () => window.cancelAnimationFrame(frame);
	}, [activeElementId, treeData, viewId]);

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
			window.requestAnimationFrame(scrollSelectedTreeNodeIntoView);
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
				onMouseEnter={({ event }) => {
					suppressNativeTreeTitle(event.currentTarget as HTMLElement);
				}}
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
	const [unlinkedForest, setUnlinkedForest] = React.useState<UnlinkedElementNode[]>([]);

	React.useEffect(() => {
		if (!viewId) {
			setUnlinkedForest([]);
			return;
		}
		const timer = window.setTimeout(() => {
			setUnlinkedForest(collectUnlinkedElementForestForView(rootStore, viewId));
		}, 0);
		return () => window.clearTimeout(timer);
	}, [viewId, rootStore.groups.groups.length, rootStore.assets.assets.length]);

	return <ElementUnlinkedListView unlinkedForest={unlinkedForest} />;
});

const ElementUnlinkedListView = observer(function ElementUnlinkedListView({
	unlinkedForest,
}: {
	unlinkedForest: UnlinkedElementNode[];
}) {
	const langtext = useLangtext();
	const navigate = useNavigate();
	const selectedId = rootStore.ui.activeElement?.id;
	const marks = rootStore.ui.elementMarks;
	const totalUnlinked = countUnlinkedElementNodes(unlinkedForest);
	const treeData = React.useMemo(
		() => unlinkedForestToTreeNodes(unlinkedForest.slice(0, UNLINKED_RENDER_LIMIT)),
		[unlinkedForest]
	);
	const [expandedKeys, setExpandedKeys] = React.useState<React.Key[]>([]);

	React.useEffect(() => {
		setExpandedKeys(collectExpandableUnlinkedKeys(treeData));
	}, [treeData]);

	React.useEffect(() => {
		if (!selectedId) {
			return;
		}
		const frame = window.requestAnimationFrame(() => {
			document
				.querySelector(".element-tree-unlinked .ant-tree-node-selected")
				?.scrollIntoView({ block: "nearest" });
		});
		return () => window.cancelAnimationFrame(frame);
	}, [selectedId, treeData, expandedKeys]);

	return (
		<div className="element-tree-unlinked">
			<div className="element-tree-unlinked__title">
				{langtext("general.tree_unlinked_components")}
				{totalUnlinked > 0 ? ` (${totalUnlinked})` : ""}
			</div>
			<div className="element-tree-unlinked__panel">
				<Tree
					checkable={false}
					selectable
					showLine
					treeData={treeData}
					expandedKeys={expandedKeys}
					onExpand={(keys) => setExpandedKeys(keys)}
					selectedKeys={selectedId ? [selectedId] : []}
					onSelect={(keys) => {
						const id = keys[0] != null ? String(keys[0]) : "";
						if (id) {
							navigateToElement(navigate, id);
						}
					}}
					onMouseEnter={({ event }) => {
						suppressNativeTreeTitle(event.currentTarget as HTMLElement);
					}}
					titleRender={(node) =>
						renderTreeNodeTitle(node, marks?.get(treeNodeElementId(node)))
					}
				/>
				{unlinkedForest.length > UNLINKED_RENDER_LIMIT ? (
					<div className="element-tree-unlinked__more">
						{langtext("general.tree_unlinked_showing_limited", {
							shown: UNLINKED_RENDER_LIMIT,
							total: unlinkedForest.length,
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
