/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { Select, Button, Col, Input, Row, Space, Tag, Tooltip, Tree, message } from "antd";
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
import { collectUnlinkedElementForestForView, countUnlinkedElementNodes, flattenUnlinkedForest, UnlinkedElementNode, UnlinkedTreeElement } from "../../../lib/treeUnlinkedAssets";
import { stageUnlinkedElementsForDelete } from "../../../lib/unlinkedElementActions";
import { environmentDisplayName, IEnvironment } from "../../../Stores/Models/Environment.Model";
import { knownEnvironmentIds, readViewEnvironmentBindings, resolveWriteEnvironmentId } from "../../../lib/viewEnvironments";
import {
	ancestorIdsFromTreeKey,
	buildElementTreeNodes,
	collectTreeNodeChildCounts,
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
import { childOrderEpoch } from "../../../lib/elementDisplayOrder";

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

const ViewGroupChildCountContext = React.createContext<Map<string, number>>(new Map());

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
	const operationalStatus = rootStore.componentStatus.statusFor(elementId);
	const hoverFields = {
		...hoverFieldsFromLiveElement(
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
		),
		...(operationalStatus ? { operationalStatus } : {}),
	};

	React.useLayoutEffect(() => {
		suppressNativeTreeTitle(hoverTargetRef.current);
	});

	const segment = resolveTreeNodeSegment(definition, nodeData.class);
	const childCounts = React.useContext(ViewGroupChildCountContext);
	const childCount = childCounts.get(elementId) ?? 0;
	const statusClasses = `${status === "new" || status === "edit" || status === "changed" || status === "invalid" ? "EditMode" : ""} ${rootStore.ui.activeElement?.id === elementId ? "ActiveElement" : ""} ${marks?.searchMatch ? "SearchMatch" : ""}`;

	return (
		<ElementDefinitionHoverTooltip fields={hoverFields}>
			<span
				ref={hoverTargetRef}
				className={`element-tree-node-title ${statusClasses}`}
			>
				<span className={`element-tree-node-title__chip ${treeNodeSegmentClassName(segment)}`}>
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
					<span className="element-tree-node-title__name">&#160;{displayName || "???"}</span>
				</span>
				{childCount > 0 ? (
					<span className="tree-node-child-count">{childCount.toLocaleString("de-DE")}</span>
				) : null}
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

const UNLINKED_RENDER_LIMIT = 1000;

const ElementHierarchyTree = observer(function ElementHierarchyTree() {
	const view = rootStore.ui.activeView;
	const viewId = view?.id;
	const assignmentEpoch = hierarchyAssignmentEpoch(rootStore.groups.groups);
	const ownerEpoch = hierarchyOwnerEpoch(rootStore.assets.assets);
	const orderEpoch = `${childOrderEpoch(rootStore.views.views)}:${childOrderEpoch(rootStore.groups.groups)}:${childOrderEpoch(rootStore.assets.assets)}`;
	const dataEpoch = `${viewId ?? ""}:${rootStore.groups.groups.length}:${rootStore.assets.assets.length}:${assignmentEpoch}:${ownerEpoch}:${orderEpoch}`;
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
	const assignmentEpoch = hierarchyAssignmentEpoch(rootStore.groups.groups);
	const ownerEpoch = hierarchyOwnerEpoch(rootStore.assets.assets);
	const groupCount = rootStore.groups.groups.length;
	const assetCount = rootStore.assets.assets.length;
	const ignoreEpoch = rootStore.environments.environments
		.map((environment) => `${environment.id}:${environment.properties.ignoredDevices.join("\u0001")}`)
		.join("\u0002");
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
	}, [viewId, groupCount, assetCount, assignmentEpoch, ownerEpoch, ignoreEpoch]);

	return <ElementUnlinkedListView unlinkedForest={unlinkedForest} />;
});

const IgnoredDeviceNameField = observer(function IgnoredDeviceNameField({
	environment,
	index,
}: {
	environment: IEnvironment;
	index: number;
}) {
	const stored = environment.properties.ignoredDevices[index] ?? "";
	const [value, setValue] = React.useState(stored);

	React.useEffect(() => {
		setValue(stored);
	}, [stored]);

	const commit = () => {
		const next = environment.properties.ignoredDevices.slice();
		next[index] = value;
		environment.setIgnoredDevices(next);
	};

	return (
		<Input
			size="small"
			value={value}
			onChange={(event) => setValue(event.target.value)}
			onBlur={commit}
			onPressEnter={(event) => (event.target as HTMLInputElement).blur()}
		/>
	);
});

const IgnoredDevicesEditor = observer(function IgnoredDevicesEditor({
	environment,
	showEnvironmentName,
}: {
	environment: IEnvironment;
	showEnvironmentName: boolean;
}) {
	const langtext = useLangtext();
	const [draft, setDraft] = React.useState("");
	const names = environment.properties.ignoredDevices;

	const addName = () => {
		const name = draft.trim();
		if (!name) {
			return;
		}
		environment.setIgnoredDevices([...names, name]);
		setDraft("");
	};

	return (
		<div className="element-tree-unlinked__ignore-env">
			{showEnvironmentName ? (
				<div className="element-tree-unlinked__ignore-env-name">{environmentDisplayName(environment)}</div>
			) : null}
			{names.map((name, index) => (
				<div className="element-tree-unlinked__ignore-row" key={`${environment.id}:${index}:${name}`}>
					<IgnoredDeviceNameField environment={environment} index={index} />
					<Button
						size="small"
						onClick={() => environment.setIgnoredDevices(names.filter((_, entryIndex) => entryIndex !== index))}
					>
						{langtext("general.tree_unlinked_ignore_remove")}
					</Button>
				</div>
			))}
			<div className="element-tree-unlinked__ignore-add">
				<Input
					size="small"
					value={draft}
					placeholder={langtext("general.tree_unlinked_ignore_placeholder")}
					onChange={(event) => setDraft(event.target.value)}
					onPressEnter={addName}
				/>
				<Button size="small" onClick={addName}>
					{langtext("general.tree_unlinked_ignore_add")}
				</Button>
			</div>
		</div>
	);
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
	const isReadOnly = rootStore.ui.isReadOnly;
	const totalUnlinked = countUnlinkedElementNodes(unlinkedForest);
	const treeData = React.useMemo(
		() => unlinkedForestToTreeNodes(unlinkedForest.slice(0, UNLINKED_RENDER_LIMIT)),
		[unlinkedForest]
	);
	const [expandedKeys, setExpandedKeys] = React.useState<React.Key[]>([]);
	const [checkedKeys, setCheckedKeys] = React.useState<React.Key[]>([]);
	const viewEnvironments = readViewEnvironmentBindings(rootStore.ui.activeView).map((binding) => binding.ref);
	const visibleIgnoreEnvironments = rootStore.environments.environments.filter((environment) => {
		return (
			environment.properties.ignoredDevices.length > 0 &&
			(viewEnvironments.includes(environment.id) || viewEnvironments.length === 0)
		);
	});

	React.useEffect(() => {
		setExpandedKeys(collectExpandableUnlinkedKeys(treeData));
	}, [treeData]);

	React.useEffect(() => {
		const present = new Set(flattenUnlinkedForest(unlinkedForest).map((element) => element.id));
		setCheckedKeys((current) => current.filter((key) => present.has(String(key))));
	}, [unlinkedForest]);

	const checkedElements = () => {
		const selected = new Set(checkedKeys.map(String));
		return flattenUnlinkedForest(unlinkedForest).filter((element) => selected.has(element.id));
	};

	const markForDelete = (elements: UnlinkedTreeElement[]) => {
		const count = stageUnlinkedElementsForDelete(rootStore, elements);
		if (count > 0) {
			message.success(langtext("general.tree_unlinked_marked", { count }));
		}
		setCheckedKeys([]);
	};

	const selectAllVisible = () => {
		setCheckedKeys(
			flattenUnlinkedForest(unlinkedForest.slice(0, UNLINKED_RENDER_LIMIT)).map((element) => element.id)
		);
	};

	const ignoreChecked = () => {
		const namesByEnvironment = new Map<string, string[]>();
		const ignored: UnlinkedTreeElement[] = [];
		for (const element of checkedElements()) {
			if (element.class !== "Asset") {
				continue;
			}
			const name = element.definition?.name?.trim() ?? "";
			if (!name) {
				continue;
			}
			const ownEnvironmentId =
				"environmentId" in element && typeof element.environmentId === "string"
					? element.environmentId.trim()
					: "";
			const environmentId =
				ownEnvironmentId ||
				resolveWriteEnvironmentId(knownEnvironmentIds(rootStore), rootStore.ui.activeView);
			if (!environmentId) {
				continue;
			}
			const names = namesByEnvironment.get(environmentId) ?? [];
			names.push(name);
			namesByEnvironment.set(environmentId, names);
			ignored.push(element);
		}
		if (namesByEnvironment.size === 0) {
			message.warning(langtext("general.tree_unlinked_ignore_needs_name"));
			return;
		}
		namesByEnvironment.forEach((names, environmentId) => {
			const environment = rootStore.environments.findById(environmentId);
			if (!environment) {
				return;
			}
			environment.setIgnoredDevices([...environment.properties.ignoredDevices, ...names]);
		});
		stageUnlinkedElementsForDelete(rootStore, ignored);
		message.success(langtext("general.tree_unlinked_ignored", { count: ignored.length }));
		setCheckedKeys([]);
	};

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
			{!isReadOnly ? (
				<div className="element-tree-unlinked__toolbar">
					<Button
						size="small"
						danger
						disabled={checkedKeys.length === 0}
						onClick={() => markForDelete(checkedElements())}
					>
						{langtext("general.tree_unlinked_mark_delete")}
					</Button>
					<Button
						size="small"
						disabled={totalUnlinked === 0}
						onClick={selectAllVisible}
					>
						{langtext("general.tree_unlinked_mark_delete_all")}
					</Button>
					<Tooltip title={langtext("general.tree_unlinked_ignore_tooltip")}>
						<span>
							<Button size="small" disabled={checkedKeys.length === 0} onClick={ignoreChecked}>
								{langtext("general.tree_unlinked_ignore")}
							</Button>
						</span>
					</Tooltip>
				</div>
			) : null}
			<div className="element-tree-unlinked__panel">
				<Tree
					checkable={!isReadOnly}
					selectable
					showLine
					treeData={treeData}
					expandedKeys={expandedKeys}
					onExpand={(keys) => setExpandedKeys(keys)}
					checkedKeys={checkedKeys}
					onCheck={(keys) => setCheckedKeys(Array.isArray(keys) ? keys : keys.checked)}
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
			{visibleIgnoreEnvironments.length > 0 ? (
				<div className="element-tree-unlinked__ignore">
					<div className="element-tree-unlinked__ignore-title">
						{langtext("general.tree_unlinked_ignore_list")}
					</div>
					{visibleIgnoreEnvironments.map((environment) =>
						isReadOnly ? (
							environment.properties.ignoredDevices.map((name) => (
								<Tag key={`${environment.id}:${name}`}>
									{visibleIgnoreEnvironments.length > 1
										? `${environmentDisplayName(environment)}: ${name}`
										: name}
								</Tag>
							))
						) : (
							<IgnoredDevicesEditor
								key={environment.id}
								environment={environment}
								showEnvironmentName={visibleIgnoreEnvironments.length > 1}
							/>
						)
					)}
				</div>
			) : null}
		</div>
	);
});

type Props = {};

export const ElementTree = observer((props: Props) => {
	const { activeElement } = rootStore.ui;
	const navigate = useNavigate();
	const langtext = useLangtext();
	const viewClasses = `${activeElement?.status === "new" || activeElement?.status === "edit" || activeElement?.status === "changed" || activeElement?.status === "invalid" ? "EditMode" : ""} ${rootStore.ui.activeView?.id === activeElement?.id ? "ActiveElement" : ""}`;
	const assignmentEpoch = hierarchyAssignmentEpoch(rootStore.groups.groups);
	const ownerEpoch = hierarchyOwnerEpoch(rootStore.assets.assets);
	const childCounts = React.useMemo(
		() => collectTreeNodeChildCounts(rootStore),
		[
			assignmentEpoch,
			ownerEpoch,
			rootStore.groups.groups.length,
			rootStore.assets.assets.length,
		]
	);

	return (
		<ViewGroupChildCountContext.Provider value={childCounts}>
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
		</ViewGroupChildCountContext.Provider>
	);
});
