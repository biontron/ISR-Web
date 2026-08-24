/*
	========================================================================
	LICENSE AGREEMENT — siehe Projekt-Header
	========================================================================
*/
import React, { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { Checkbox, Button, List, Col, Row, Tabs, Input } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { rootStore } from "../../../../Stores/Root.Store";
import { ActiveElement } from "../../../../Interfaces/Element";
import { IAsset } from "../../../../Stores/Models/Asset.Model";
import { IGroup } from "../../../../Stores/Models/Group.Model";
import SchemaSvgIcon from "../../../Schema/SchemaSvgIcon";
import { useLangtext } from "../../../../lib/common";
import {
	isLogicalViewGroupElement,
	LinkedChildElement,
	resolveElementRefId,
	toPlainElementIdRefs,
} from "../../../../lib/elementChildLinks";

function hasReferenceMappingFields(
	element: ActiveElement | undefined
): element is ActiveElement & {
	elementIdRefs: Array<{ id: unknown }>;
	filterRules: unknown[];
} {
	if (!element) return false;
	if (element.class !== "Group" && element.class !== "Asset") return false;
	return true;
}

function resolveRefElement(id: string): LinkedChildElement | undefined {
	return (
		rootStore.assets.assets.find((asset: IAsset) => asset.id === id) ??
		rootStore.groups.groups.find((group: IGroup) => group.id === id)
	);
}

const AssetReferenceMapping: React.FC<{ element: ActiveElement }> = observer(({ element }) => {
	const langtext = useLangtext();
	const showXPathTab = isLogicalViewGroupElement(element);

	const [selectedPotential, setSelectedPotential] = useState<LinkedChildElement[]>([]);
	const [selectedConnected, setSelectedConnected] = useState<string[]>([]);
	const [filterRulesText, setFilterRulesText] = useState("[]");

	useEffect(() => {
		if (!hasReferenceMappingFields(element)) {
			setSelectedConnected([]);
			setFilterRulesText("[]");
			return;
		}

		if (typeof (element as { ensureMappingFields?: () => void }).ensureMappingFields === "function") {
			(element as { ensureMappingFields: () => void }).ensureMappingFields();
		}

		const refs = toPlainElementIdRefs(element.elementIdRefs);
		setSelectedConnected(refs.map((ref) => resolveElementRefId(ref)).filter((id): id is string => !!id));

		try {
			const rules = element.filterRules || [];
			setFilterRulesText(JSON.stringify(rules, null, 2));
		} catch {
			setFilterRulesText("[]");
		}
	}, [element]);

	const connectedElements = useMemo(() => {
		if (!hasReferenceMappingFields(element)) return [];

		const refs = toPlainElementIdRefs(element.elementIdRefs);
		const connected: LinkedChildElement[] = [];
		for (const ref of refs) {
			const id = resolveElementRefId(ref);
			if (!id) {
				continue;
			}
			const found = resolveRefElement(id);
			if (found) {
				connected.push(found);
			}
		}
		return connected;
	}, [element, rootStore.assets.assets.length, rootStore.groups.groups.length]);

	const connectedIds = useMemo(
		() => new Set(connectedElements.map((item) => item.id)),
		[connectedElements]
	);

	const potentialElements = useMemo(() => {
		const candidates: LinkedChildElement[] = [
			...rootStore.assets.assets,
			...rootStore.groups.groups,
		];
		return candidates.filter((item) => item.id !== element?.id && !connectedIds.has(item.id));
	}, [connectedIds, element?.id, rootStore.assets.assets.length, rootStore.groups.groups.length]);

	const persistElementIdRefs = (nextRefs: Array<{ id: string }>) => {
		if (!hasReferenceMappingFields(element)) return;

		const model = element as {
			setElementIdRefs?: (refs: Array<{ id: string }>) => void;
			beginEdit?: () => void;
			setValueByPath?: (path: string, value: unknown) => void;
			markTouched?: () => void;
			elementIdRefs?: unknown;
		};

		if (typeof model.setElementIdRefs === "function") {
			model.setElementIdRefs(nextRefs);
		} else {
			model.beginEdit?.();
			if (typeof model.setValueByPath === "function") {
				model.setValueByPath("elementIdRefs", nextRefs);
			} else {
				model.elementIdRefs = nextRefs;
				model.markTouched?.();
			}
		}
	};

	const persistFilterRules = (nextRules: unknown[]) => {
		if (!hasReferenceMappingFields(element)) return;

		if (typeof (element as { setFilterRules?: (rules: unknown[]) => void }).setFilterRules === "function") {
			(element as { setFilterRules: (rules: unknown[]) => void }).setFilterRules(nextRules);
		}
	};

	const shiftLeft = () => {
		if (selectedPotential.length === 0 || !hasReferenceMappingFields(element)) return;

		const currentRefs = toPlainElementIdRefs(element.elementIdRefs);
		const existingIds = new Set(
			currentRefs.map((ref) => resolveElementRefId(ref)).filter((id): id is string => !!id)
		);
		const nextRefs = currentRefs
			.map((ref) => resolveElementRefId(ref))
			.filter((id): id is string => !!id)
			.map((id) => ({ id }));

		selectedPotential.forEach((item) => {
			if (!existingIds.has(item.id)) {
				nextRefs.push({ id: item.id });
			}
		});

		persistElementIdRefs(nextRefs);
		setSelectedPotential([]);
	};

	const shiftRight = () => {
		if (selectedConnected.length === 0 || !hasReferenceMappingFields(element)) return;

		const removeIds = new Set(selectedConnected);
		const nextRefs = toPlainElementIdRefs(element.elementIdRefs)
			.map((ref) => resolveElementRefId(ref))
			.filter((id): id is string => !!id && !removeIds.has(id))
			.map((id) => ({ id }));

		persistElementIdRefs(nextRefs);
		setSelectedConnected([]);
	};

	const applyFilterRules = () => {
		try {
			const parsed = JSON.parse(filterRulesText);
			if (!Array.isArray(parsed)) throw new Error("Must be array");
			persistFilterRules(parsed);
		} catch (error) {
			console.error("Invalid filterRules JSON", error);
		}
	};

	if (!hasReferenceMappingFields(element)) {
		return null;
	}

	const renderLinkedList = (
		items: LinkedChildElement[],
		onToggle: (item: LinkedChildElement, checked: boolean) => void,
		isChecked: (item: LinkedChildElement) => boolean
	) => (
		<List<LinkedChildElement>
			dataSource={items}
			renderItem={(item) => (
				<List.Item>
					<Checkbox
						checked={isChecked(item)}
						onChange={(e) => onToggle(item, e.target.checked)}
					>
						<SchemaSvgIcon
							svgString={rootStore.configSchemas.getIconByDefinition(item?.definition)}
							element={item}
						/>
						{"label" in item.definition && item.definition.label
							? `${item.definition.label} (${item.definition.name})`
							: item.definition.name}
					</Checkbox>
				</List.Item>
			)}
			style={{ maxHeight: 200, overflowY: "auto" }}
		/>
	);

	const staticMapping = (
		<Row gutter={[16, 16]} justify="start" align="top">
			<Col span={11}>
				<div>{langtext("general.elementchilds_assigned")}</div>
				{renderLinkedList(
					connectedElements,
					(item, checked) => {
						if (checked) {
							setSelectedConnected((prev) => [...prev, item.id]);
						} else {
							setSelectedConnected((prev) => prev.filter((id) => id !== item.id));
						}
					},
					(item) => selectedConnected.includes(item.id)
				)}
			</Col>

			<Col span={2} style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
				<Button icon={<LeftOutlined />} type="primary" onClick={shiftLeft} style={{ marginBottom: 8 }} />
				<Button icon={<RightOutlined />} type="primary" onClick={shiftRight} style={{ marginBottom: 8 }} />
			</Col>

			<Col span={11}>
				<div>{langtext("general.available") || "Verfügbar"}</div>
				{renderLinkedList(
					potentialElements,
					(item, checked) => {
						if (checked) {
							setSelectedPotential((prev) => [...prev, item]);
						} else {
							setSelectedPotential((prev) => prev.filter((entry) => entry.id !== item.id));
						}
					},
					(item) => selectedPotential.some((entry) => entry.id === item.id)
				)}
			</Col>
		</Row>
	);

	if (!showXPathTab) {
		return staticMapping;
	}

	return (
		<Tabs
			items={[
				{ key: "static", label: langtext("general.elementchilds_assigned"), children: staticMapping },
				{
					key: "xpath",
					label: langtext("general.assetreference_filter_rules"),
					children: (
						<>
							<p className="schema-editor-empty__message">
								{langtext("general.assetreference_filter_rules_hint")}
							</p>
							<Input.TextArea
								value={filterRulesText}
								onChange={(e) => setFilterRulesText(e.target.value)}
								autoSize={{ minRows: 6, maxRows: 16 }}
								style={{ fontFamily: "monospace", fontSize: 12 }}
							/>
							<Button type="primary" onClick={applyFilterRules} style={{ marginTop: 8 }}>
								{langtext("edit_store")}
							</Button>
						</>
					)
				}
			]}
		/>
	);
});

export default AssetReferenceMapping;
