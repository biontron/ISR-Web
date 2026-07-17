/*
	========================================================================
	LICENSE AGREEMENT — siehe ConfigSchemaSelector
	========================================================================
*/

import React, { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { Alert, Button, Descriptions, Empty, Space, Table, Tabs, Tooltip } from "antd";
import { CodeOutlined } from "@ant-design/icons";
import { rootStore } from "../../../Stores/Root.Store";
import SchemaEditor from "../../../Components/Schema/SchemaEditor/SchemaEditor.Component";
import SchemaDetailsActions from "../../../Components/Schema/SchemaDetailsActions";
import JsonInspectDialog from "../../../Components/ChangeMode/JsonInspectDialog";
import { getLanguageText, useLangtext } from "../../../lib/common";
import { resolveJsonInspectTarget, buildConfigSchemaJsonInspectTarget } from "../../../lib/jsonInspectResolve";
import { IElement } from "../../../Stores/Models/Element.Model";
import { SchemaBaseType } from "../../../lib/schemaDomain";
import { isSchemaUserEditable } from "../../../lib/schemaDomainPolicy";
import { ISchemaModel } from "../../../Stores/Models/Schema.Model";
import { IConnectSchemaModel } from "../../../Stores/Models/ConnectSchema.Model";
import { ISchemaItem } from "../../../Stores/Types/SchemaItem";
import { IConnectSchemaItem } from "../../../Stores/Types/ConnectSchemaItem";
import {
	createDockpartSchemaPreviewInstance,
	createEditorSchemaPreviewInstance,
	editorSchemaPreviewPathPrefix,
	resolveLiveDockpartSchemaDefinition,
	resolveLiveEditorSchemaDefinition,
} from "../../../lib/schemaPreviewInstances";
import { SchemaParentTypeHighlight } from "../../../Components/Schema/SchemaParentTypeHighlight";
import { parentTypeHighlightTokens } from "../../../lib/schemaParentRestrictions";

const { TabPane } = Tabs;

interface ConfigSchemaDetailsProps {
	baseType: SchemaBaseType;
	schemaId: string | null;
}

const ConfigSchemaDetails: React.FC<ConfigSchemaDetailsProps> = observer(
	({ baseType, schemaId }) => {
		const langtext = useLangtext();
		const { isReadOnly } = rootStore.ui;
		const [activeTab, setActiveTab] = useState("1");
		const [jsonInspectOpen, setJsonInspectOpen] = useState(false);

		const schema = schemaId
			? rootStore.configSchemas.getSchema(baseType, schemaId)
			: undefined;

		const policyEditable = schema ? isSchemaUserEditable(schema, isReadOnly) : false;
		const canEditSchema =
			!!schema && policyEditable && (schema.status === "edit" || schema.status === "changed");
		const showEditActions = !!schema && policyEditable && !isReadOnly;

		const metaSchemaForm = useMemo(
			() => rootStore.configSchemas.findSchemaByType("SCHEMA", ""),
			[
				rootStore.configSchemas.internals.length,
				rootStore.configSchemas.components.length,
			]
		);

		const resolvedEditorSchema = useMemo(() => {
			if (!schema || baseType === "DOCKPART") {
				return undefined;
			}
			return resolveLiveEditorSchemaDefinition(schema as ISchemaModel);
		}, [schema, baseType]);

		const resolvedDockpartSchema = useMemo(() => {
			if (!schema || baseType !== "DOCKPART") {
				return undefined;
			}
			return resolveLiveDockpartSchemaDefinition(schema as IConnectSchemaModel);
		}, [schema, baseType]);

		const previewInstance = useMemo(() => {
			if (!schema) {
				return undefined;
			}
			if (baseType === "DOCKPART") {
				return createDockpartSchemaPreviewInstance(schema as IConnectSchemaModel);
			}
			return createEditorSchemaPreviewInstance(schema as ISchemaModel);
		}, [schema, baseType]);

		const previewPathPrefix =
			schema && baseType !== "DOCKPART"
				? editorSchemaPreviewPathPrefix(schema as ISchemaModel)
				: "";

		const resolvedSchema =
			baseType === "DOCKPART" ? resolvedDockpartSchema : resolvedEditorSchema;

		if (!schemaId) {
			return (
				<div className="editor-schema-details editor-schema-details--empty">
					<Empty
						image={Empty.PRESENTED_IMAGE_SIMPLE}
						description={langtext("general.schema_select_required")}
					/>
				</div>
			);
		}

		if (!schema) {
			return (
				<div className="editor-schema-details editor-schema-details--empty">
					<div>Error: Schema "{schemaId}" not found.</div>
				</div>
			);
		}

		const overviewColumns = [
			{ title: "Order", dataIndex: "order", key: "order", width: 64 },
			{ title: "Label", dataIndex: "label", key: "label" },
			{ title: "Item", dataIndex: "itemName", key: "itemName" },
		];

		const overviewData = resolvedSchema
			? resolvedSchema.items.map((item: ISchemaItem | IConnectSchemaItem, index: number) => ({
				key: index,
				order: item.order,
				label: getLanguageText(item.formProperties.label),
				itemName: item.dataStructure.itemName,
			}))
			: [];

		const detailsTitle = langtext("general.schema_details_title", {
			name: getLanguageText(schema.name),
		});
		const jsonInspectTarget = buildConfigSchemaJsonInspectTarget(schema as IElement, baseType);

		return (
			<div className="editor-schema-details">
				<JsonInspectDialog
					open={jsonInspectOpen}
					target={jsonInspectTarget}
					onClose={() => setJsonInspectOpen(false)}
				/>
				<Tabs
					className="editor-schema-details-tabs"
					activeKey={activeTab}
					onChange={setActiveTab}
					destroyInactiveTabPane={false}
					tabBarExtraContent={
						<Space size="small">
							<Tooltip title={langtext("general.json_inspect")}>
								<Button
									icon={<CodeOutlined />}
									onClick={() => setJsonInspectOpen(true)}
								/>
							</Tooltip>
							{showEditActions ? (
								<SchemaDetailsActions schema={schema} compact />
							) : null}
						</Space>
					}
				>
					<TabPane tab={langtext("general.details_tab_overview")} key="1">
						<div className="editor-schema-tab-panel">
							<h3>{detailsTitle}</h3>
							{baseType === "DOCKPART" && (
								<p style={{ color: "#666", marginBottom: 12 }}>
									Definiert die Felder für{" "}
									<strong>ein einzelnes Dockpart-Element</strong>.
								</p>
							)}
							<Descriptions size="small" column={2} style={{ marginBottom: 12 }}>
								<Descriptions.Item label="baseType">{schema.baseType}</Descriptions.Item>
								<Descriptions.Item label="Type">{schema.type}</Descriptions.Item>
								<Descriptions.Item label="ID">{schema.id}</Descriptions.Item>
								<Descriptions.Item label="Description" span={2}>
									{getLanguageText(schema.description)}
								</Descriptions.Item>
								<Descriptions.Item
									label={baseType === "DOCKPART" ? "Stack darunter" : "Whitelist"}
								>
									<SchemaParentTypeHighlight
										value={schema.parent.whitelist.slice().sort().join(", ")}
										highlightTokens={parentTypeHighlightTokens(schema.parent.whitelist)}
									/>
								</Descriptions.Item>
								<Descriptions.Item
									label={baseType === "DOCKPART" ? "Ausgeschlossen" : "Blacklist"}
								>
									{schema.parent.blacklist.slice().sort().join(", ") || "—"}
								</Descriptions.Item>
							</Descriptions>
							<Table
								columns={overviewColumns}
								dataSource={overviewData}
								pagination={false}
								size="small"
							/>
						</div>
					</TabPane>
					<TabPane tab={langtext("general.details_tab_edit")} key="2">
						<div className="editor-schema-tab-panel editor-schema-tab-panel--editor">
							{showEditActions ? <SchemaDetailsActions schema={schema} /> : null}
							{!policyEditable && (
								<Alert
									type="info"
									showIcon
									style={{ marginBottom: 12 }}
									message={langtext("general.schema_readonly_system")}
								/>
							)}
							{metaSchemaForm ? (
								<div className="editor-schema-form-shell">
									<SchemaEditor
										schemaDefinition={metaSchemaForm}
										schemaName="SCHEMA"
										pathPrefix=""
										elementData={schema}
										canEdit={canEditSchema}
									/>
								</div>
							) : (
								<Alert
									type="error"
									showIcon
									style={{ marginBottom: 12 }}
									message="Meta-Schema „SCHEMA“ ist nicht geladen."
								/>
							)}
						</div>
					</TabPane>
					<TabPane tab={langtext("general.details_tab_preview")} key="3">
						<div className="editor-schema-tab-panel editor-schema-tab-panel--editor">
							{resolvedSchema && previewInstance ? (
								<div className="editor-schema-form-shell">
									<SchemaEditor
										schemaDefinition={resolvedSchema}
										schemaName={schema.type}
										pathPrefix={previewPathPrefix}
										elementData={previewInstance as any}
										canEdit={false}
									/>
								</div>
							) : (
								<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Voransicht nicht verfügbar" />
							)}
						</div>
					</TabPane>
				</Tabs>
			</div>
		);
	}
);

export default ConfigSchemaDetails;
