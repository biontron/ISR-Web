/*
	========================================================================
	LICENSE AGREEMENT — siehe Projekt-Header
	========================================================================
*/
import React, { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { Checkbox, Button, List, Col, Row, Tabs, Input } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { getIdentifier } from "mobx-state-tree";
import { rootStore } from "../../../../Stores/Root.Store";
import { ActiveElement } from "../../../../Interfaces/Element";
import { IAsset } from "../../../../Stores/Models/Asset.Model";
import SchemaSvgIcon from "../../../Schema/SchemaSvgIcon";
import { useLangtext } from "../../../../lib/common";

function elementRefId(ref: { id: unknown }): string {
	if (typeof ref.id === "string") return ref.id;
	return getIdentifier(ref.id as IAsset) ?? "";
}

// Type Guard
// === VERBESSERTER TYPE GUARD ===
function hasReferenceMappingFields(
	element: ActiveElement | undefined
): element is ActiveElement & {
	elementIdRefs: Array<{ id: unknown }>;
	filterRules: unknown[];
} {
	if (!element) return false;
	if (element.class !== "Group" && element.class !== "Asset") return false;

	// Type assertion für TypeScript
	return true;
}

const AssetReferenceMapping: React.FC<{ element: ActiveElement }> = observer(({ element }) => {
	const langtext = useLangtext();

	const [selectedPotential, setSelectedPotential] = useState<IAsset[]>([]);
	const [selectedConnected, setSelectedConnected] = useState<string[]>([]);
	const [filterRulesText, setFilterRulesText] = useState("[]");

	// === USEEFFECT ===
	useEffect(() => {
		if (!hasReferenceMappingFields(element)) {
			setSelectedConnected([]);
			setFilterRulesText("[]");
			return;
		}

		// Felder sicherstellen
		if (typeof (element as any).ensureMappingFields === "function") {
			(element as any).ensureMappingFields();
		}

		// Explizites Mapping mit Type Cast
		const refs = (element as any).elementIdRefs || [];
		setSelectedConnected(refs.map((ref: any) => elementRefId(ref)));

		try {
			const rules = (element as any).filterRules || [];
			setFilterRulesText(JSON.stringify(rules, null, 2));
		} catch {
			setFilterRulesText("[]");
		}
	}, [element]);

	const connectedElements = useMemo(() => {
		if (!hasReferenceMappingFields(element)) return [];

		const refs = (element as any).elementIdRefs || [];

		return rootStore.assets.assets.filter((asset: IAsset) =>
			refs.some((ref: any) => elementRefId(ref) === asset.id)
		);
	}, [element, rootStore.assets.assets.length]);

	const potentialElements = useMemo(() => {
		return rootStore.assets.assets.filter(
			(asset: IAsset) => !connectedElements.some((connected) => connected.id === asset.id)
		);
	}, [connectedElements, rootStore.assets.assets.length]);

	const persistElementIdRefs = (nextRefs: Array<{ id: string }>) => {
		if (!hasReferenceMappingFields(element)) return;

		const model = element as any;

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

		if (typeof (element as any).setFilterRules === "function") {
			(element as any).setFilterRules(nextRules);
		}
	};

	const shiftLeft = () => {
		if (selectedPotential.length === 0) return;

		const el = element as any;
		const currentRefs: Array<{ id: string }> = el.elementIdRefs || [];
		const existingIds = new Set(currentRefs.map(r => elementRefId(r)));

		const nextRefs = [...currentRefs];

		selectedPotential.forEach((asset) => {
			if (!existingIds.has(asset.id)) {
				nextRefs.push({ id: asset.id });
			}
		});

		persistElementIdRefs(nextRefs);
		setSelectedPotential([]);
	};

	const shiftRight = () => {
		if (selectedConnected.length === 0) return;

		const el = element as any;
		const removeIds = new Set(selectedConnected);

		const nextRefs = (el.elementIdRefs || []).filter(
			(ref: any) => !removeIds.has(elementRefId(ref))
		);

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

	// ... Rest der Komponente (staticMapping + Tabs) bleibt gleich wie in meiner letzten Version

	const staticMapping = (
		<Row gutter={[16, 16]} justify="start" align="top">
			<Col span={11}>
				<div>{langtext("general.assigned") || "Zugeordnet"}</div>
				<List<IAsset>
					dataSource={connectedElements}
					renderItem={(item) => (
						<List.Item>
							<Checkbox
								checked={selectedConnected.includes(item.id)}
								onChange={(e) => {
									if (e.target.checked) {
										setSelectedConnected(prev => [...prev, item.id]);
									} else {
										setSelectedConnected(prev => prev.filter(id => id !== item.id));
									}
								}}
							>
								<SchemaSvgIcon
									svgString={rootStore.configSchemas.getIconByDefinition(item?.definition)}
									element={item}
								/>
								{item.definition.label} ({item.definition.name})
							</Checkbox>
						</List.Item>
					)}
					style={{ maxHeight: 200, overflowY: "auto" }}
				/>
			</Col>

			<Col span={2} style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
				<Button icon={<LeftOutlined />} type="primary" onClick={shiftLeft} style={{ marginBottom: 8 }} />
				<Button icon={<RightOutlined />} type="primary" onClick={shiftRight} style={{ marginBottom: 8 }} />
			</Col>

			<Col span={11}>
				<div>{langtext("general.available") || "Verfügbar"}</div>
				<List<IAsset>
					dataSource={potentialElements}
					renderItem={(item) => (
						<List.Item>
							<Checkbox
								checked={selectedPotential.some(a => a.id === item.id)}
								onChange={(e) => {
									if (e.target.checked) {
										setSelectedPotential(prev => [...prev, item]);
									} else {
										setSelectedPotential(prev => prev.filter(a => a.id !== item.id));
									}
								}}
							>
								<SchemaSvgIcon
									svgString={rootStore.configSchemas.getIconByDefinition(item?.definition)}
									element={item}
								/>
								{item.definition.label} ({item.definition.name})
							</Checkbox>
						</List.Item>
					)}
					style={{ maxHeight: 200, overflowY: "auto" }}
				/>
			</Col>
		</Row>
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