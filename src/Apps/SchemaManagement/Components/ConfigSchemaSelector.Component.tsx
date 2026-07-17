/*
	========================================================================
	LICENSE AGREEMENT — siehe ConfigSchemaDetails
	========================================================================
*/

import React, { useEffect, useMemo, useState } from "react";
import { Button, Table, Radio, Tabs } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { observer } from "mobx-react";
import { useSearchParams } from "react-router-dom";
import { rootStore } from "../../../Stores/Root.Store";
import ConfigSchemaDetails from "./ConfigSchemaDetails.Component";
import CreateSchemaDialog from "./CreateSchemaDialog.Component";
import SchemaSvgIcon from "../../../Components/Schema/SchemaSvgIcon";
import SchemaManagerSplitLayout from "../../../Components/Schema/SchemaManagerSplitLayout";
import {
	SchemaParentTypeCell,
	SchemaParentTypeHighlight,
} from "../../../Components/Schema/SchemaParentTypeHighlight";
import { getLanguageText, useLangtext } from "../../../lib/common";
import { parentTypeHighlightTokens } from "../../../lib/schemaParentRestrictions";
import { SchemaBaseType } from "../../../lib/schemaDomain";
import { isSchemaUserCreatable } from "../../../lib/schemaDomainPolicy";
import { IConnectSchemaModel } from "../../../Stores/Models/ConnectSchema.Model";
import { ISchemaModel } from "../../../Stores/Models/Schema.Model";

interface SchemaDataItem {
	key: number;
	icon: string;
	baseType: string;
	schemaType: string;
	schemaId: string;
	name: string;
	description: string;
	whitelist: string;
	blacklist: string;
}

const BASE_TYPE_TABS: { key: SchemaBaseType; labelKey: string }[] = [
	{ key: "VIEWGROUP", labelKey: "general.schema_tab_viewgroups" },
	{ key: "COMPONENT", labelKey: "general.schema_tab_element" },
	{ key: "DOCKPART", labelKey: "general.schema_tab_dockpart" },
	{ key: "INTERNAL", labelKey: "general.schema_tab_internal" },
];

function baseTypeFromSearchParam(value: string | null): SchemaBaseType {
	if (
		value === "INTERNAL" ||
		value === "VIEWGROUP" ||
		value === "COMPONENT" ||
		value === "DOCKPART"
	) {
		return value;
	}
	if (value === "ELEMENT") {
		return "COMPONENT";
	}
	if (value === "SYSTEM") {
		return "INTERNAL";
	}
	const upper = value?.toUpperCase();
	if (upper === "DOCKPART" || upper === "PORTPART") {
		return "DOCKPART";
	}
	return "COMPONENT";
}

const ConfigSchemaSelector: React.FC = observer(() => {
	const langtext = useLangtext();
	const [searchParams, setSearchParams] = useSearchParams();
	const tabFromUrl = baseTypeFromSearchParam(searchParams.get("tab"));
	const [activeBaseType, setActiveBaseType] = useState<SchemaBaseType>(tabFromUrl);
	const [selectedSchemaId, setSelectedSchemaId] = useState<string | null>(
		rootStore.ui.selectedConfigSchemaId || null
	);
	const [createOpen, setCreateOpen] = useState(false);
	const { isReadOnly } = rootStore.ui;

	useEffect(() => {
		setActiveBaseType(tabFromUrl);
		rootStore.ui.setSelectedSchemaBaseType(tabFromUrl);
	}, [tabFromUrl]);

	const handleTabChange = (key: string) => {
		const baseType = key as SchemaBaseType;
		setActiveBaseType(baseType);
		setSelectedSchemaId(null);
		rootStore.ui.clearSelectedConfigSchemaId();
		rootStore.ui.setSelectedSchemaBaseType(baseType);
		setSearchParams({ tab: baseType });
	};

	const selectedSchema = selectedSchemaId
		? rootStore.configSchemas.getSchema(activeBaseType, selectedSchemaId)
		: undefined;
	const selectedParentWhitelist = selectedSchema?.parent.whitelist.slice() ?? [];
	const selectedParentBlacklist = selectedSchema?.parent.blacklist.slice() ?? [];
	const selectedParentHighlightTokens = selectedSchema
		? parentTypeHighlightTokens(selectedParentWhitelist)
		: null;

	const columns = useMemo(
		() => [
			{
				title: "#",
				key: "select",
				width: 32,
				align: "center" as const,
				render: (_: unknown, record: SchemaDataItem) => (
					<Radio
						checked={selectedSchemaId === record.schemaId}
						onChange={() => {
							setSelectedSchemaId(record.schemaId);
							rootStore.ui.setSelectedConfigSchemaId(record.schemaId);
						}}
					/>
				),
			},
			{
				title: "",
				key: "icon",
				width: 32,
				align: "center" as const,
				render: (_: unknown, record: SchemaDataItem) => (
					<SchemaSvgIcon svgString={record.icon} element={record} />
				),
			},
			{
				title: "baseType",
				dataIndex: "baseType",
				key: "baseType",
				width: 96,
				sorter: (a: SchemaDataItem, b: SchemaDataItem) => a.baseType.localeCompare(b.baseType),
			},
			{
				title: "Typ",
				dataIndex: "schemaType",
				key: "schemaType",
				sorter: (a: SchemaDataItem, b: SchemaDataItem) =>
					a.schemaType.localeCompare(b.schemaType),
				render: (_: unknown, record: SchemaDataItem) => (
					<SchemaParentTypeCell
						type={record.schemaType}
						id={record.schemaId}
						childWhitelist={selectedParentWhitelist}
						childBlacklist={selectedParentBlacklist}
					/>
				),
			},
			{
				title: "ID",
				dataIndex: "schemaId",
				key: "schemaId",
				sorter: (a: SchemaDataItem, b: SchemaDataItem) => a.schemaId.localeCompare(b.schemaId),
				render: (_: unknown, record: SchemaDataItem) => (
					<SchemaParentTypeCell
						type={record.schemaId}
						id={record.schemaId}
						childWhitelist={selectedParentWhitelist}
						childBlacklist={selectedParentBlacklist}
					/>
				),
			},
			{
				title: "Name",
				dataIndex: "name",
				key: "name",
				sorter: (a: SchemaDataItem, b: SchemaDataItem) => a.name.localeCompare(b.name),
			},
			{
				title: "Description",
				dataIndex: "description",
				key: "description",
				sorter: (a: SchemaDataItem, b: SchemaDataItem) =>
					a.description.localeCompare(b.description),
			},
			{
				title: activeBaseType === "DOCKPART" ? "Stack darunter" : "Whitelist",
				dataIndex: "whitelist",
				key: "whitelist",
				render: (_: unknown, record: SchemaDataItem) => (
					<SchemaParentTypeHighlight
						value={record.whitelist}
						highlightTokens={
							selectedSchemaId === record.schemaId ? selectedParentHighlightTokens : null
						}
						emptyPlaceholder=""
					/>
				),
			},
			{
				title: activeBaseType === "DOCKPART" ? "Ausgeschlossen" : "Blacklist",
				dataIndex: "blacklist",
				key: "blacklist",
			},
		],
		[
			activeBaseType,
			selectedSchemaId,
			selectedParentWhitelist,
			selectedParentBlacklist,
			selectedParentHighlightTokens,
		]
	);

	const schemas = rootStore.configSchemas.getSchemas(activeBaseType);
	const data = schemas.map((schema: ISchemaModel | IConnectSchemaModel, index: number) => ({
		key: index,
		icon: schema.style.treeIcon,
		baseType: schema.baseType,
		schemaType: schema.type,
		schemaId: schema.id,
		name: getLanguageText(schema.name),
		description: getLanguageText(schema.description),
		whitelist: schema.parent.whitelist.slice().sort().join(", "),
		blacklist: schema.parent.blacklist.slice().sort().join(", "),
	}));

	const canCreate = isSchemaUserCreatable(activeBaseType, isReadOnly);

	return (
		<div className="editor-schema-selector config-schema-selector">
			<Tabs
				activeKey={activeBaseType}
				onChange={handleTabChange}
				items={BASE_TYPE_TABS.map(({ key, labelKey }) => ({
					key,
					label: langtext(labelKey),
					children: (
						<SchemaManagerSplitLayout
							top={
								<div className="editor-schema-table-area">
									{canCreate && (
										<div style={{ marginBottom: 8 }}>
											<Button
												type="primary"
												icon={<PlusOutlined />}
												onClick={() => setCreateOpen(true)}
											>
												{langtext("general.schema_create")}
											</Button>
										</div>
									)}
									<Table
										className="editor-schema-table"
										columns={columns}
										dataSource={data}
										pagination={false}
										size="small"
										sticky
										onRow={(record) => ({
											onClick: () => {
												setSelectedSchemaId(record.schemaId);
												rootStore.ui.setSelectedConfigSchemaId(record.schemaId);
											},
										})}
									/>
								</div>
							}
							bottom={
								<div className="editor-schema-details-area">
									<ConfigSchemaDetails
										baseType={activeBaseType}
										schemaId={selectedSchemaId}
									/>
								</div>
							}
						/>
					),
				}))}
			/>
			{canCreate && (
				<CreateSchemaDialog
					open={createOpen}
					baseType={activeBaseType}
					onClose={() => setCreateOpen(false)}
					onCreated={(schemaId) => {
						setCreateOpen(false);
						setSelectedSchemaId(schemaId);
						rootStore.ui.setSelectedConfigSchemaId(schemaId);
					}}
				/>
			)}
		</div>
	);
});

export default ConfigSchemaSelector;
