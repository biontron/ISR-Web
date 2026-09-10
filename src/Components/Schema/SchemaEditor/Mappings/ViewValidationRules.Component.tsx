import React, { useState } from "react";
import { Button, Col, Input, List, Radio, Row } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { observer } from "mobx-react";
import { IView } from "../../../../Stores/Models/View.Model";
import { rootStore } from "../../../../Stores/Root.Store";
import { useLangtext } from "../../../../lib/common";
import {
	addValidationRule,
	removeValidationRule,
	snapshotValidationRules,
	updateValidationRule,
	type ValidationRulePolarity,
	type ValidationRuleRecord,
} from "../../../../lib/elementXPathValidation";

const ViewValidationRules: React.FC<{ view: IView }> = observer(({ view }) => {
	const langtext = useLangtext();
	const canEdit = !rootStore.ui.isReadOnly;
	const [xpathDraft, setXpathDraft] = useState("");
	const [descriptionDraft, setDescriptionDraft] = useState("");
	const [polarityDraft, setPolarityDraft] = useState<ValidationRulePolarity>("negative");
	const rules = snapshotValidationRules(view.validationRules);

	const persist = (next: ValidationRuleRecord[]) => {
		view.setValidationRules(next);
	};

	return (
		<>
			<p className="schema-editor-empty__message">
				{langtext("general.view_validation_rules_hint")}
			</p>
			<List
				dataSource={rules}
				locale={{ emptyText: langtext("general.view_validation_rules_empty") }}
				renderItem={(rule, index) => (
					<List.Item
						actions={[
							<Button
								key="delete"
								type="text"
								danger
								icon={<DeleteOutlined />}
								disabled={!canEdit}
								onClick={() => persist(removeValidationRule(rules, index))}
							>
								{langtext("general.delete")}
							</Button>,
						]}
					>
						<div style={{ width: "100%" }}>
							<Input
								value={rule.description}
								disabled={!canEdit}
								placeholder={langtext("general.assetreference_filter_description_placeholder")}
								onChange={(event) =>
									persist(
										updateValidationRule(rules, index, {
											description: event.target.value,
										})
									)
								}
								style={{ marginBottom: 6 }}
							/>
							<Radio.Group
								value={rule.polarity}
								disabled={!canEdit}
								onChange={(event) =>
									persist(
										updateValidationRule(rules, index, {
											polarity: event.target.value,
										})
									)
								}
								style={{ marginBottom: 6 }}
							>
								<Radio.Button value="positive">
									{langtext("general.view_validation_positive")}
								</Radio.Button>
								<Radio.Button value="negative">
									{langtext("general.view_validation_negative")}
								</Radio.Button>
							</Radio.Group>
							<code>{rule.xpath}</code>
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
			<Row gutter={8} style={{ marginBottom: 8 }}>
				<Col span={24}>
					<Radio.Group
						value={polarityDraft}
						disabled={!canEdit}
						onChange={(event) => setPolarityDraft(event.target.value)}
					>
						<Radio.Button value="positive">
							{langtext("general.view_validation_positive")}
						</Radio.Button>
						<Radio.Button value="negative">
							{langtext("general.view_validation_negative")}
						</Radio.Button>
					</Radio.Group>
				</Col>
			</Row>
			<Row gutter={8} style={{ marginBottom: 16 }}>
				<Col flex="auto">
					<Input
						value={xpathDraft}
						disabled={!canEdit}
						placeholder={langtext("general.assetreference_filter_placeholder")}
						onChange={(event) => setXpathDraft(event.target.value)}
						onPressEnter={() => {
							if (!canEdit || !xpathDraft.trim()) {
								return;
							}
							persist(addValidationRule(rules, xpathDraft, descriptionDraft, polarityDraft));
							setXpathDraft("");
							setDescriptionDraft("");
						}}
					/>
				</Col>
				<Col>
					<Button
						type="primary"
						icon={<PlusOutlined />}
						disabled={!canEdit || xpathDraft.trim() === ""}
						onClick={() => {
							persist(addValidationRule(rules, xpathDraft, descriptionDraft, polarityDraft));
							setXpathDraft("");
							setDescriptionDraft("");
						}}
					>
						{langtext("general.add")}
					</Button>
				</Col>
			</Row>
		</>
	);
});

export default ViewValidationRules;
