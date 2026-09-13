import React, { useEffect, useState } from "react";
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
	type ValidationRuleRecord,
	type ValidationRuleType,
} from "../../../../lib/elementXPathValidation";

const ViewValidationRules: React.FC<{ view: IView }> = observer(({ view }) => {
	const langtext = useLangtext();
	const canEdit = !rootStore.ui.isReadOnly;
	const [xpathDraft, setXpathDraft] = useState("");
	const [commentDraft, setCommentDraft] = useState("");
	const [typeDraft, setTypeDraft] = useState<ValidationRuleType>("negative");
	const rules = snapshotValidationRules(view.validationRules);
	const pendingXpath = rootStore.ui.pendingValidationRuleXpath;
	const pendingComment = rootStore.ui.pendingValidationRuleComment;
	const pendingViewId = rootStore.ui.pendingValidationRuleViewId;

	useEffect(() => {
		if (!pendingXpath || pendingViewId !== view.id) {
			return;
		}
		setXpathDraft(pendingXpath);
		setCommentDraft(pendingComment);
		rootStore.ui.clearPendingValidationRule();
	}, [pendingXpath, pendingComment, pendingViewId, view.id]);

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
								value={rule.comment}
								disabled={!canEdit}
								placeholder={langtext("general.assetreference_filter_description_placeholder")}
								onChange={(event) =>
									persist(
										updateValidationRule(rules, index, {
											comment: event.target.value,
										})
									)
								}
								style={{ marginBottom: 6 }}
							/>
							<Radio.Group
								value={rule.type}
								disabled={!canEdit}
								onChange={(event) =>
									persist(
										updateValidationRule(rules, index, {
											type: event.target.value as ValidationRuleType,
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
						value={commentDraft}
						disabled={!canEdit}
						placeholder={langtext("general.assetreference_filter_description_placeholder")}
						onChange={(event) => setCommentDraft(event.target.value)}
					/>
				</Col>
			</Row>
			<Row gutter={8} style={{ marginBottom: 8 }}>
				<Col span={24}>
					<Radio.Group
						value={typeDraft}
						disabled={!canEdit}
						onChange={(event) => setTypeDraft(event.target.value as ValidationRuleType)}
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
							persist(addValidationRule(rules, xpathDraft, commentDraft, typeDraft));
							setXpathDraft("");
							setCommentDraft("");
						}}
					/>
				</Col>
				<Col>
					<Button
						type="primary"
						icon={<PlusOutlined />}
						disabled={!canEdit || xpathDraft.trim() === ""}
						onClick={() => {
							persist(addValidationRule(rules, xpathDraft, commentDraft, typeDraft));
							setXpathDraft("");
							setCommentDraft("");
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
