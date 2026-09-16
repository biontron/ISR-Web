/*
	========================================================================
	LICENSE AGREEMENT — siehe Projekt-Header
	========================================================================
*/
import React, { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { Checkbox, Button, List, Col, Row, Input, Empty } from "antd";
import {
	LeftOutlined,
	RightOutlined,
	DoubleLeftOutlined,
	DoubleRightOutlined,
	DeleteOutlined,
	PlusOutlined,
} from "@ant-design/icons";
import { rootStore } from "../../../../Stores/Root.Store";
import { ActiveElement } from "../../../../Interfaces/Element";
import { IAsset } from "../../../../Stores/Models/Asset.Model";
import { IGroup } from "../../../../Stores/Models/Group.Model";
import { IView } from "../../../../Stores/Models/View.Model";
import { environmentDisplayName } from "../../../../Stores/Models/Environment.Model";
import SchemaSvgIcon from "../../../Schema/SchemaSvgIcon";
import { useLangtext } from "../../../../lib/common";
import {
	addXPathFilterRule,
	AssignableTreeElement,
	assignMappedElement,
	assignmentKey,
	collectAssignedElements,
	collectUnassignedElements,
	readXPathExpression,
	removeXPathFilterRule,
	unassignElementFromParent,
	updateXPathFilterRule,
} from "../../../../lib/elementAssignments";
import { toFilterRuleRecord } from "../../../../lib/filterRuleNormalize";
import {
	collectFilteredMappingCandidates,
} from "../../../../lib/elementAutomapping";
import { resolvePrimaryEnvironmentRef, readViewEnvironmentBindings } from "../../../../lib/viewEnvironments";
import {
	collectLinkedAssetIdsForView,
	collectViewGroupsUnderView,
} from "../../../../lib/treeUnlinkedAssets";
import { readEnvironmentId } from "../../../../lib/environmentIdentity";

type MappingParent = IView | IGroup | IAsset;

function hasAssignmentParent(
	element: ActiveElement | undefined
): element is MappingParent {
	return element?.class === "View" || element?.class === "Group" || element?.class === "Asset";
}

function hasFilterRules(element: MappingParent): element is IView | IGroup {
	return element.class === "View" || element.class === "Group";
}

const CANDIDATE_RENDER_LIMIT = 250;

type AppliedCandidateFilter = {
	searchText: string;
	environmentIds: string[];
	rules: unknown[];
};

const MappingSearchCriteria = observer(function MappingSearchCriteria({
	element,
	applied,
	onApply,
	onClear,
}: {
	element: IView | IGroup;
	applied: boolean;
	onApply: (filter: AppliedCandidateFilter) => void;
	onClear: () => void;
}) {
	const langtext = useLangtext();
	const canEdit = !rootStore.ui.isReadOnly;
	const activeView = rootStore.ui.activeView;
	const [xpathDraft, setXpathDraft] = useState("");
	const [descriptionDraft, setDescriptionDraft] = useState("");
	const [searchText, setSearchText] = useState("");
	const [selectedEnvIds, setSelectedEnvIds] = useState<string[]>(() =>
		readViewEnvironmentBindings(rootStore.ui.activeView).map((binding) => binding.ref)
	);

	const viewEnvironments = useMemo(() => {
		const bindings = readViewEnvironmentBindings(activeView);
		if (bindings.length > 0) {
			return bindings
				.map((binding) => rootStore.environments.findById(binding.ref))
				.filter((environment): environment is NonNullable<typeof environment> => !!environment);
		}
		return [...rootStore.environments.environments];
	}, [activeView, rootStore.environments.environments.length]);

	const viewEnvIds = viewEnvironments.map((environment) => environment.id).join("|");

	useEffect(() => {
		setSelectedEnvIds(viewEnvironments.map((environment) => environment.id));
	}, [activeView?.id, viewEnvIds]);

	const xpathRules = [...element.filterRules];

	const persistFilterRules = (nextRules: unknown[]) => {
		if (typeof element.setFilterRules !== "function") {
			return;
		}
		element.setFilterRules(nextRules);
	};

	const addXPath = () => {
		if (!canEdit) {
			return;
		}
		const primary = resolvePrimaryEnvironmentRef(rootStore.ui.activeView);
		persistFilterRules(
			addXPathFilterRule(
				[...element.filterRules],
				xpathDraft,
				descriptionDraft,
				primary ? [{ ref: primary }] : [],
				true
			)
		);
		setXpathDraft("");
		setDescriptionDraft("");
	};

	return (
		<fieldset
			className={`asset-reference-search-criteria${applied ? " asset-reference-search-criteria--applied" : ""}`}
		>
			<legend>{langtext("general.assetreference_filter_criteria")}</legend>
			<Input.Search
				allowClear
				value={searchText}
				placeholder={langtext("general.element_search_placeholder")}
				onChange={(event) => setSearchText(event.target.value)}
				onSearch={setSearchText}
			/>
			<div className="asset-reference-filter-mask__section">
				<div className="asset-reference-filter-mask__label">
					{langtext("general.assetreference_filter_saved_searches")}
				</div>
				{xpathRules.length === 0 ? (
					<div className="asset-reference-filter-mask__empty">
						{langtext("general.assetreference_filter_empty")}
					</div>
				) : (
					xpathRules.map((rule, index) => {
						const record = toFilterRuleRecord(rule);
						const label = record.description.trim() || record.xpath;
						return (
							<div key={`${record.xpath}-${index}`} className="asset-reference-filter-mask__rule">
								<Checkbox
									checked={record.activated}
									disabled={!canEdit}
									onChange={(event) =>
										persistFilterRules(
											updateXPathFilterRule([...xpathRules], index, {
												activated: event.target.checked,
											})
										)
									}
								>
									{label}
								</Checkbox>
								<Input
									value={record.description}
									disabled={!canEdit}
									placeholder={langtext("general.assetreference_filter_description_placeholder")}
									onChange={(event) =>
										persistFilterRules(
											updateXPathFilterRule([...xpathRules], index, {
												description: event.target.value,
											})
										)
									}
								/>
								<code>{readXPathExpression(rule) || String(rule)}</code>
								<Button
									type="text"
									danger
									icon={<DeleteOutlined />}
									disabled={!canEdit}
									onClick={() => {
										if (!canEdit) {
											return;
										}
										persistFilterRules(removeXPathFilterRule([...element.filterRules], index));
									}}
								>
									{langtext("general.delete")}
								</Button>
							</div>
						);
					})
				)}
				<Row gutter={8} style={{ marginTop: 8 }}>
					<Col span={24}>
						<Input
							value={descriptionDraft}
							disabled={!canEdit}
							placeholder={langtext("general.assetreference_filter_description_placeholder")}
							onChange={(event) => setDescriptionDraft(event.target.value)}
						/>
					</Col>
				</Row>
				<Row gutter={8} style={{ marginTop: 8 }}>
					<Col flex="auto">
						<Input
							value={xpathDraft}
							disabled={!canEdit}
							placeholder={langtext("general.assetreference_filter_placeholder")}
							onChange={(event) => setXpathDraft(event.target.value)}
							onPressEnter={addXPath}
						/>
					</Col>
					<Col>
						<Button
							type="primary"
							icon={<PlusOutlined />}
							disabled={!canEdit || xpathDraft.trim() === ""}
							onClick={addXPath}
						>
							{langtext("general.add")}
						</Button>
					</Col>
				</Row>
			</div>
			<div className="asset-reference-filter-mask__section">
				<div className="asset-reference-filter-mask__label">
					{langtext("general.assetreference_filter_environments")}
				</div>
				{viewEnvironments.length === 0 ? (
					<div className="asset-reference-filter-mask__empty">
						{langtext("general.view_environments_empty")}
					</div>
				) : (
					viewEnvironments.map((environment) => (
						<Checkbox
							key={environment.id}
							checked={selectedEnvIds.includes(environment.id)}
							onChange={(event) =>
								setSelectedEnvIds((prev) =>
									event.target.checked
										? [...prev, environment.id]
										: prev.filter((id) => id !== environment.id)
								)
							}
						>
							{environmentDisplayName(environment)}
						</Checkbox>
					))
				)}
			</div>
			<div className="asset-reference-filter-mask__actions">
				<Button
					onClick={() =>
						onApply({
							searchText,
							environmentIds: [...selectedEnvIds],
							rules: xpathRules.map((rule) => toFilterRuleRecord(rule)),
						})
					}
				>
					{langtext("general.assetreference_filter_apply")}
				</Button>
				<Button onClick={onClear} disabled={!applied}>
					{langtext("general.assetreference_filter_clear")}
				</Button>
			</div>
		</fieldset>
	);
});

const AssetReferenceMapping: React.FC<{ element: ActiveElement }> = observer(({ element }) => {
	const langtext = useLangtext();
	const canEdit = !rootStore.ui.isReadOnly;
	const activeView = rootStore.ui.activeView;

	const [selectedAssignedKeys, setSelectedAssignedKeys] = useState<string[]>([]);
	const [selectedAvailableKeys, setSelectedAvailableKeys] = useState<string[]>([]);
	const [unlinkedOnly, setUnlinkedOnly] = useState(true);
	const [appliedFilter, setAppliedFilter] = useState<AppliedCandidateFilter | null>(null);

	useEffect(() => {
		setAppliedFilter(null);
	}, [element?.id]);

	const mappingParent = hasAssignmentParent(element) ? element : undefined;
	const assignedElements = mappingParent
		? collectAssignedElements(rootStore, mappingParent.id)
		: [];

	const viewId = activeView?.id;
	const parentRefsKey =
		mappingParent && "elementIdRefs" in mappingParent
			? mappingParent.elementIdRefs.map((ref) => `${ref.id}`).join(",")
			: "";
	const availableElements = useMemo(() => {
		if (!mappingParent) {
			return [];
		}
		if (!hasFilterRules(mappingParent)) {
			return collectUnassignedElements(rootStore, mappingParent.id);
		}
		if (!appliedFilter) {
			return [];
		}
		const viewGroups = viewId ? collectViewGroupsUnderView(rootStore, viewId) : [];
		const viewLinkedAssetIds =
			unlinkedOnly && viewId ? collectLinkedAssetIdsForView(rootStore, viewId) : undefined;
		const viewLinkedGroupIds = unlinkedOnly
			? new Set(viewGroups.map((group) => group.id))
			: undefined;
		return collectFilteredMappingCandidates(rootStore, mappingParent.id, {
			searchText: appliedFilter.searchText,
			environmentIds: appliedFilter.environmentIds,
			rules: appliedFilter.rules,
			unlinkedOnly,
			viewLinkedAssetIds,
			viewLinkedGroupIds,
		});
	}, [
		appliedFilter,
		mappingParent,
		parentRefsKey,
		unlinkedOnly,
		viewId,
		rootStore.assets.assets.length,
		rootStore.groups.groups.length,
	]);
	const visibleAvailable = availableElements.slice(0, CANDIDATE_RENDER_LIMIT);

	if (!mappingParent) {
		return null;
	}

	const toggleSelection = (ids: string[], id: string, checked: boolean) =>
		checked ? [...ids, id] : ids.filter((item) => item !== id);

	const selectedAssigned = assignedElements.filter((item) =>
		selectedAssignedKeys.includes(assignmentKey(item))
	);
	const selectedAvailable = availableElements.filter((item) =>
		selectedAvailableKeys.includes(assignmentKey(item))
	);

	const shiftLeft = () => {
		if (!canEdit || selectedAvailable.length === 0) {
			return;
		}
		selectedAvailable.forEach((child) => assignMappedElement(child, mappingParent));
		setSelectedAvailableKeys([]);
	};

	const shiftRight = () => {
		if (!canEdit || selectedAssigned.length === 0) {
			return;
		}
		selectedAssigned.forEach((child) => unassignElementFromParent(child, mappingParent));
		setSelectedAssignedKeys([]);
	};

	const shiftAllLeft = () => {
		if (!canEdit || availableElements.length === 0) {
			return;
		}
		availableElements.forEach((child) => assignMappedElement(child, mappingParent));
		setSelectedAvailableKeys([]);
	};

	const shiftAllRight = () => {
		if (!canEdit || assignedElements.length === 0) {
			return;
		}
		assignedElements.forEach((child) => unassignElementFromParent(child, mappingParent));
		setSelectedAssignedKeys([]);
	};

	const environmentLabel = (item: AssignableTreeElement) => {
		if (item.class !== "Asset") {
			return "";
		}
		const environmentId = readEnvironmentId(item as IAsset);
		if (!environmentId) {
			return "";
		}
		const environment = rootStore.environments.findById(environmentId);
		return ` · ${environment ? environmentDisplayName(environment) : environmentId}`;
	};

	const renderElementRow = (
		item: AssignableTreeElement,
		selectedIds?: string[],
		onToggle?: (id: string, checked: boolean) => void
	) => {
		const key = assignmentKey(item);
		const label = (
			<>
				<SchemaSvgIcon
					svgString={rootStore.configSchemas.getIconByDefinition(item.definition)}
					element={item}
				/>
				{item.definition.name}
				{item.class === "Group" ? " (View-Gruppe)" : " (Asset)"}
				{environmentLabel(item)}
			</>
		);

		if (!onToggle || !selectedIds) {
			return <List.Item>{label}</List.Item>;
		}

		return (
			<List.Item>
				<Checkbox
					checked={selectedIds.includes(key)}
					disabled={!canEdit}
					onChange={(event) => onToggle(key, event.target.checked)}
				>
					{label}
				</Checkbox>
			</List.Item>
		);
	};

	const renderElementLists = (
		leftTitle: string,
		leftItems: AssignableTreeElement[],
		rightTitle: string,
		rightItems: AssignableTreeElement[],
		options?: {
			leftSelectedIds?: string[];
			rightSelectedIds?: string[];
			onToggleLeft?: (id: string, checked: boolean) => void;
			onToggleRight?: (id: string, checked: boolean) => void;
			actions?: React.ReactNode;
		}
	) => (
		<Row gutter={[16, 16]} justify="start" align="top">
			<Col span={11}>
				<div>{leftTitle}</div>
				<List<AssignableTreeElement>
					dataSource={leftItems}
					locale={{ emptyText: <Empty description={leftTitle} /> }}
					renderItem={(item) =>
						renderElementRow(item, options?.leftSelectedIds, options?.onToggleLeft)
					}
					style={{ maxHeight: 280, overflowY: "auto" }}
				/>
			</Col>

			<Col span={2} style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
				{options?.actions}
			</Col>

			<Col span={11}>
				<div>{rightTitle}</div>
				<List<AssignableTreeElement>
					dataSource={rightItems}
					locale={{ emptyText: <Empty description={rightTitle} /> }}
					renderItem={(item) =>
						renderElementRow(item, options?.rightSelectedIds, options?.onToggleRight)
					}
					style={{ maxHeight: 280, overflowY: "auto" }}
				/>
			</Col>
		</Row>
	);

	const mappingLists = renderElementLists(
		langtext("general.assetreference_assigned"),
		assignedElements,
		langtext("general.assetreference_available"),
		visibleAvailable,
		{
			leftSelectedIds: selectedAssignedKeys,
			rightSelectedIds: selectedAvailableKeys,
			onToggleLeft: (id, checked) =>
				setSelectedAssignedKeys((prev) => toggleSelection(prev, id, checked)),
			onToggleRight: (id, checked) =>
				setSelectedAvailableKeys((prev) => toggleSelection(prev, id, checked)),
			actions: (
				<>
					<Button
						icon={<DoubleLeftOutlined />}
						onClick={shiftAllLeft}
						disabled={!canEdit || availableElements.length === 0}
						title={langtext("general.assetreference_filter_assign_all")}
						style={{ marginBottom: 8 }}
					/>
					<Button
						icon={<LeftOutlined />}
						type="primary"
						onClick={shiftLeft}
						disabled={!canEdit || selectedAvailable.length === 0}
						style={{ marginBottom: 8 }}
					/>
					<Button
						icon={<RightOutlined />}
						type="primary"
						onClick={shiftRight}
						disabled={!canEdit || selectedAssigned.length === 0}
						style={{ marginBottom: 8 }}
					/>
					<Button
						icon={<DoubleRightOutlined />}
						onClick={shiftAllRight}
						disabled={!canEdit || assignedElements.length === 0}
						title={langtext("general.assetreference_filter_unassign_all")}
					/>
				</>
			),
		}
	);

	if (!hasFilterRules(mappingParent)) {
		return mappingLists;
	}

	return (
		<>
			<p className="schema-editor-empty__message">
				{langtext("general.assetreference_filter_rules_hint")}
			</p>
			<MappingSearchCriteria
				element={mappingParent}
				applied={!!appliedFilter}
				onApply={(filter) => {
					setAppliedFilter(filter);
					setSelectedAvailableKeys([]);
				}}
				onClear={() => {
					setAppliedFilter(null);
					setSelectedAvailableKeys([]);
				}}
			/>
			<div className="asset-reference-filter-unlinked">
				<Checkbox checked={unlinkedOnly} onChange={(event) => setUnlinkedOnly(event.target.checked)}>
					{langtext("general.assetreference_filter_unlinked_only")}
				</Checkbox>
			</div>
			{mappingLists}
		</>
	);
});

export default AssetReferenceMapping;
