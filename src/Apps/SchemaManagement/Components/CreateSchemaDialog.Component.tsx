/*
	========================================================================
	LICENSE AGREEMENT — siehe andere App-Dateien
	========================================================================
*/

import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Input, Modal, Space, Steps, Tag, Tree, message } from "antd";
import type { DataNode } from "antd/es/tree";
import { observer } from "mobx-react";
import authStore from "../../../Stores/Auth.Store";
import { rootStore } from "../../../Stores/Root.Store";
import { ConnectSchemaModel } from "../../../Stores/Models/ConnectSchema.Model";
import { SchemaModel } from "../../../Stores/Models/Schema.Model";
import { useLangtext } from "../../../lib/common";
import { SchemaBaseType } from "../../../lib/schemaDomain";
import { createEmptySchemaPayload } from "../../../lib/schemaCreateDefaults";
import { activityStatusOverviewUi } from "../../../lib/activityStatusOverviewUi";
import {
	GeneratedSchemaItem,
	SchemaSampleFormat,
	SchemaSampleParseError,
	SchemaSampleParseReason,
	countSchemaItems,
	detectSampleFormat,
	parseSampleDocument,
	schemaItemsFromValue,
} from "../../../lib/schemaFromSample";

interface CreateSchemaDialogProps {
	open: boolean;
	baseType: SchemaBaseType;
	onClose: () => void;
	onCreated: (schemaId: string) => void;
}

interface SampleDraft {
	format: SchemaSampleFormat;
	items: GeneratedSchemaItem[];
	suggestedId?: string;
}

const CreateSchemaDialog: React.FC<CreateSchemaDialogProps> = observer(
	({ open, baseType, onClose, onCreated }) => {
		const langtext = useLangtext();
		const [step, setStep] = useState(0);
		const [schemaId, setSchemaId] = useState("");
		const [idTouched, setIdTouched] = useState(false);
		const [source, setSource] = useState("");
		const [parseError, setParseError] = useState<string | null>(null);
		const [draft, setDraft] = useState<SampleDraft | null>(null);
		const [previewKey, setPreviewKey] = useState(0);
		const [submitting, setSubmitting] = useState(false);

		useEffect(() => {
			if (!open) {
				return;
			}
			setStep(0);
			setSchemaId("");
			setIdTouched(false);
			setSource("");
			setParseError(null);
			setDraft(null);
			setSubmitting(false);
		}, [open]);

		const detectedFormat = detectSampleFormat(source);

		const formatLabel = (format: SchemaSampleFormat) => {
			if (format === "xml") {
				return langtext("general.schema_create_format_xml");
			}
			if (format === "yaml") {
				return langtext("general.schema_create_format_yaml");
			}
			return langtext("general.schema_create_format_json");
		};

		const parseReasonText = (reason: SchemaSampleParseReason) => {
			switch (reason) {
				case "empty":
					return langtext("general.schema_create_sample_required");
				case "xml":
					return langtext("general.schema_create_sample_invalid_xml");
				case "tabs":
					return langtext("general.schema_create_sample_yaml_tabs");
				case "anchor":
					return langtext("general.schema_create_sample_yaml_anchor");
				case "yaml":
					return langtext("general.schema_create_sample_invalid_yaml");
				case "json":
				default:
					return langtext("general.schema_create_sample_invalid_json");
			}
		};

		const treeData = useMemo(() => {
			const toNodes = (items: GeneratedSchemaItem[], path: string): DataNode[] =>
				items.map((item, index) => {
					const name =
						item.dataStructure.itemName || langtext("general.schema_create_value_label");
					const key = `${path}/${index}/${name}`;
					if (item.kind === "field") {
						const example = item.example
							? ` · ${item.example.length > 40 ? `${item.example.slice(0, 40)}…` : item.example}`
							: "";
						return {
							key,
							title: `${name} · ${item.fieldType}${example}`,
							isLeaf: true,
						};
					}
					const kindLabel =
						item.collectionType === "array"
							? langtext("general.schema_create_kind_array")
							: langtext("general.schema_create_kind_map");
					return {
						key,
						title: `${name} · ${kindLabel}`,
						children: toNodes(item.items, key),
					};
				});
			return draft ? toNodes(draft.items, "root") : [];
		}, [draft, langtext]);

		const goNext = () => {
			if (step === 0) {
				try {
					const parsed = parseSampleDocument(source);
					const items = schemaItemsFromValue(parsed.value);
					setDraft({
						format: parsed.format,
						items,
						suggestedId: parsed.suggestedId,
					});
					setParseError(null);
					if (!idTouched && parsed.suggestedId) {
						setSchemaId(parsed.suggestedId);
					}
					setPreviewKey((current) => current + 1);
					setStep(1);
				} catch (error) {
					const reason =
						error instanceof SchemaSampleParseError ? error.reason : "json";
					setDraft(null);
					setParseError(parseReasonText(reason));
				}
				return;
			}

			const trimmed = schemaId.trim();
			if (!trimmed) {
				message.warning(langtext("general.schema_create_id_required"));
				return;
			}
			if (rootStore.configSchemas.getSchema(baseType, trimmed)) {
				message.error(langtext("general.schema_create_id_exists"));
				return;
			}
			setSchemaId(trimmed);
			setStep(2);
		};

		const handleSubmit = () => {
			const trimmed = schemaId.trim();
			if (!trimmed || !draft) {
				return;
			}
			if (!authStore.getDomain()) {
				message.error(langtext("general.schema_create_failed"));
				return;
			}
			if (rootStore.configSchemas.getSchema(baseType, trimmed)) {
				message.error(langtext("general.schema_create_id_exists"));
				setStep(1);
				return;
			}

			setSubmitting(true);
			try {
				const payload = {
					...createEmptySchemaPayload(trimmed, baseType),
					items: draft.items,
				};
				const model =
					baseType === "DOCKPART"
						? ConnectSchemaModel.create(payload as never)
						: SchemaModel.create(payload as never);
				rootStore.configSchemas.stageNewSchema(model);
				onCreated(trimmed);
				activityStatusOverviewUi.show("write");
				message.success(langtext("general.schema_create_staged"));
			} catch (error) {
				message.error(
					error instanceof Error ? error.message : langtext("general.schema_create_failed")
				);
			} finally {
				setSubmitting(false);
			}
		};

		const footer = (
			<Space>
				<Button onClick={onClose}>{langtext("general.cancel")}</Button>
				{step > 0 && (
					<Button onClick={() => setStep((current) => current - 1)}>
						{langtext("general.schema_create_back")}
					</Button>
				)}
				{step < 2 ? (
					<Button type="primary" onClick={goNext}>
						{langtext("general.continue")}
					</Button>
				) : (
					<Button type="primary" loading={submitting} onClick={handleSubmit}>
						{langtext("general.schema_create_submit")}
					</Button>
				)}
			</Space>
		);

		return (
			<Modal
				title={langtext("general.schema_create")}
				open={open}
				onCancel={onClose}
				footer={footer}
				width={760}
				destroyOnClose
				maskClosable={false}
			>
				<div className="schema-create-wizard">
					<Steps
						size="small"
						current={step}
						onChange={(next) => {
							if (next < step) {
								setStep(next);
							}
						}}
						items={[
							{ title: langtext("general.schema_create_step_sample") },
							{ title: langtext("general.schema_create_step_id") },
							{ title: langtext("general.schema_create_step_preview") },
						]}
					/>

					{step === 0 && (
						<div className="schema-create-wizard__step">
							<div className="schema-create-wizard__label">
								<span>{langtext("general.schema_create_sample_label")}</span>
								{detectedFormat && <Tag>{formatLabel(detectedFormat)}</Tag>}
							</div>
							<Input.TextArea
								className="schema-create-wizard__sample"
								value={source}
								onChange={(event) => {
									setSource(event.target.value);
									setParseError(null);
								}}
								autoSize={{ minRows: 12, maxRows: 18 }}
								placeholder={langtext("general.schema_create_sample_placeholder")}
							/>
							<p className="schema-create-wizard__hint">
								{langtext("general.schema_create_sample_hint")}
							</p>
							{parseError && <Alert type="error" showIcon message={parseError} />}
						</div>
					)}

					{step === 1 && (
						<div className="schema-create-wizard__step">
							<label className="schema-create-wizard__label" htmlFor="schema-create-id">
								{langtext("general.schema_create_id_label")}
							</label>
							<Input
								id="schema-create-id"
								value={schemaId}
								onChange={(event) => {
									setIdTouched(true);
									setSchemaId(event.target.value);
								}}
								onPressEnter={goNext}
								placeholder="MY-TYPE"
							/>
						</div>
					)}

					{step === 2 && draft && (
						<div className="schema-create-wizard__step">
							<p className="schema-create-wizard__hint">
								{langtext("general.schema_create_preview_summary", {
									format: formatLabel(draft.format),
									count: countSchemaItems(draft.items),
									id: schemaId.trim(),
								})}
							</p>
							<p className="schema-create-wizard__hint">
								{langtext("general.schema_create_staged")}
							</p>
							{draft.items.length === 0 ? (
								<Alert
									type="info"
									showIcon
									message={langtext("general.schema_create_preview_empty")}
								/>
							) : (
								<div className="schema-create-wizard__preview">
									<Tree
										key={previewKey}
										treeData={treeData}
										defaultExpandAll
										selectable={false}
									/>
								</div>
							)}
						</div>
					)}
				</div>
			</Modal>
		);
	}
);

export default CreateSchemaDialog;
