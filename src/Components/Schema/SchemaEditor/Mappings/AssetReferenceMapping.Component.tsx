/*
	========================================================================
	LICENSE AGREEMENT — siehe Projekt-Header
	========================================================================
*/
import React, { useState } from "react";
import { observer } from "mobx-react";
import { Checkbox, Button, List, Col, Row, Tabs, Input, Empty } from "antd";
import { LeftOutlined, RightOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { rootStore } from "../../../../Stores/Root.Store";
import { ActiveElement } from "../../../../Interfaces/Element";
import { IAsset } from "../../../../Stores/Models/Asset.Model";
import { IGroup } from "../../../../Stores/Models/Group.Model";
import { IView } from "../../../../Stores/Models/View.Model";
import SchemaSvgIcon from "../../../Schema/SchemaSvgIcon";
import { useLangtext } from "../../../../lib/common";
import {
	addXPathFilterRule,
	AssignableTreeElement,
	assignElementToParent,
	collectAssignedElements,
	collectUnassignedElements,
	readXPathExpression,
	removeXPathFilterRule,
	unassignElementFromParent,
	updateXPathFilterRule,
} from "../../../../lib/elementAssignments";
import { filterRuleDescription } from "../../../../lib/filterRuleNormalize";
import {
	collectFilterAvailableElements,
	collectFilterMatchedElements,
} from "../../../../lib/elementXPathFilter";

type MappingParent = IView | IGroup | IAsset;

function hasAssignmentParent(
	element: ActiveElement | undefined
): element is MappingParent {
	return element?.class === "View" || element?.class === "Group" || element?.class === "Asset";
}

function hasFilterRules(
	element: MappingParent
): element is MappingParent & { filterRules: unknown[]; setFilterRules?: (rules: unknown[]) => void } {
	return element.class === "View" || element.class === "Group";
}

const AssetReferenceMapping: React.FC<{ element: ActiveElement }> = observer(({ element }) => {
	const langtext = useLangtext();
	const canEdit = !rootStore.ui.isReadOnly;

	const [selectedAssignedIds, setSelectedAssignedIds] = useState<string[]>([]);
	const [selectedAvailableIds, setSelectedAvailableIds] = useState<string[]>([]);
	const [xpathDraft, setXpathDraft] = useState("");
	const [descriptionDraft, setDescriptionDraft] = useState("");

	const assignedElements = hasAssignmentParent(element)
		? collectAssignedElements(rootStore, element.id)
		: [];
	const availableElements = hasAssignmentParent(element)
		? collectUnassignedElements(rootStore, element.id)
		: [];

	if (!hasAssignmentParent(element)) {
		return null;
	}

	const toggleSelection = (ids: string[], id: string, checked: boolean) =>
		checked ? [...ids, id] : ids.filter((item) => item !== id);

	const selectedAssigned = assignedElements.filter((item) =>
		selectedAssignedIds.includes(item.id)
	);
	const selectedAvailable = availableElements.filter((item) =>
		selectedAvailableIds.includes(item.id)
	);

	const shiftLeft = () => {
		if (!canEdit || selectedAvailable.length === 0) {
			return;
		}
		selectedAvailable.forEach((child) => assignElementToParent(child, element.id));
		setSelectedAvailableIds([]);
	};

	const shiftRight = () => {
		if (!canEdit || selectedAssigned.length === 0) {
			return;
		}
		selectedAssigned.forEach((child) => unassignElementFromParent(child, element));
		setSelectedAssignedIds([]);
	};

	const persistFilterRules = (nextRules: unknown[]) => {
		if (!hasFilterRules(element) || typeof element.setFilterRules !== "function") {
			return;
		}
		element.setFilterRules(nextRules);
	};

	const addXPath = () => {
		if (!hasFilterRules(element) || !canEdit) {
			return;
		}
		persistFilterRules(addXPathFilterRule([...element.filterRules], xpathDraft, descriptionDraft));
		setXpathDraft("");
		setDescriptionDraft("");
	};

	const deleteXPath = (index: number) => {
		if (!hasFilterRules(element) || !canEdit) {
			return;
		}
		persistFilterRules(removeXPathFilterRule([...element.filterRules], index));
	};

	const renderElementRow = (
		item: AssignableTreeElement,
		selectedIds?: string[],
		onToggle?: (id: string, checked: boolean) => void
	) => {
		const label = (
			<>
				<SchemaSvgIcon
					svgString={rootStore.configSchemas.getIconByDefinition(item.definition)}
					element={item}
				/>
				{item.definition.name}
				{item.class === "Group" ? " (View-Gruppe)" : " (Asset)"}
			</>
		);

		if (!onToggle || !selectedIds) {
			return <List.Item>{label}</List.Item>;
		}

		return (
			<List.Item>
				<Checkbox
					checked={selectedIds.includes(item.id)}
					disabled={!canEdit}
					onChange={(event) => onToggle(item.id, event.target.checked)}
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

	const staticMapping = renderElementLists(
		langtext("general.assetreference_assigned"),
		assignedElements,
		langtext("general.assetreference_available"),
		availableElements,
		{
			leftSelectedIds: selectedAssignedIds,
			rightSelectedIds: selectedAvailableIds,
			onToggleLeft: (id, checked) =>
				setSelectedAssignedIds((prev) => toggleSelection(prev, id, checked)),
			onToggleRight: (id, checked) =>
				setSelectedAvailableIds((prev) => toggleSelection(prev, id, checked)),
			actions: (
				<>
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
					/>
				</>
			),
		}
	);

	if (element.class === "Asset") {
		return staticMapping;
	}

	const xpathRules = hasFilterRules(element) ? [...element.filterRules] : [];
	const filterMatchedElements = collectFilterMatchedElements(
		rootStore,
		element.id,
		xpathRules
	);
	const filterAvailableElements = collectFilterAvailableElements(
		rootStore,
		element.id,
		xpathRules
	);

	return (
		<Tabs
			items={[
				{ key: "static", label: langtext("general.assetreference_assigned"), children: staticMapping },
				{
					key: "xpath",
					label: langtext("general.assetreference_filter_rules"),
					children: (
						<>
							<p className="schema-editor-empty__message">
								{langtext("general.assetreference_filter_rules_hint")}
							</p>
							<List
								dataSource={xpathRules}
								locale={{ emptyText: langtext("general.assetreference_filter_empty") }}
								renderItem={(rule, index) => (
									<List.Item
										actions={[
											<Button
												key="delete"
												type="text"
												danger
												icon={<DeleteOutlined />}
												disabled={!canEdit}
												onClick={() => deleteXPath(index)}
											>
												{langtext("general.delete")}
											</Button>,
										]}
									>
										<div style={{ width: "100%" }}>
											<Input
												value={filterRuleDescription(rule)}
												disabled={!canEdit}
												placeholder={langtext("general.assetreference_filter_description_placeholder")}
												onChange={(event) =>
													persistFilterRules(
														updateXPathFilterRule([...xpathRules], index, {
															description: event.target.value,
														})
													)
												}
												style={{ marginBottom: 6 }}
											/>
											<code>{readXPathExpression(rule) || String(rule)}</code>
										</div>
									</List.Item>
								)}
							/>
							<Row gutter={8} style={{ marginTop: 8, marginBottom: 8 }}>
								<Col span={24}>
									<Input
										value={descriptionDraft}
										disabled={!canEdit}
										placeholder={langtext("general.assetreference_filter_description_placeholder")}
										onChange={(event) => setDescriptionDraft(event.target.value)}
									/>
								</Col>
							</Row>
							<Row gutter={8} style={{ marginBottom: 16 }}>
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
							{renderElementLists(
								langtext("general.assetreference_filter_matched"),
								filterMatchedElements,
								langtext("general.assetreference_filter_available"),
								filterAvailableElements
							)}
						</>
					),
				},
			]}
		/>
	);
});

export default AssetReferenceMapping;
