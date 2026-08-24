/*
# SPDX-License-Identifier: GPL-2.0*/

import { Modal, Table, Tabs, Tag, Tooltip, message } from "antd";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { rootStore } from "../../Stores/Root.Store";
import authStore from "../../Stores/Auth.Store";
import { ActiveElement, isTreeElement } from "../../Interfaces/Element";
import { ISchemaModel } from "../../Stores/Models/Schema.Model";
import SchemaSvgIcon from "../Schema/SchemaSvgIcon";
import { getLanguageText, useLangtext } from "../../lib/common";
import {
	ElementCreateTarget,
	resolveCreateTargetForSchema,
	resolveElementSchemaParentType,
} from "../../lib/elementDefinitionTypes";
import {
	isParentTypeInSchemaBlacklist,
	isParentTypeInSchemaWhitelist,
} from "../../lib/schemaParentRestrictions";

interface SchemaSelectionDialogProps {
	visible: boolean;
	element: ActiveElement;
	onCancel: () => void;
	onOk: (selectedKey: string | null) => void;
}

interface SchemaData {
	schemaType: string;
	baseType: string;
	key: string;
	name: string;
	description: string;
	svgIcon: string;
	createTarget: ElementCreateTarget;
}

type CreateTabKey = "structure" | "component";

function resolveSchemaForSelection(selectedSchemaId: string): ISchemaModel | undefined {
	return (
		rootStore.configSchemas.findSchemaById(selectedSchemaId) ??
		rootStore.configSchemas.schemaCompat.find((item) => item.id === selectedSchemaId)
	);
}

function createNewElement(
	parentElement: ActiveElement,
	selectedSchemaId: string
): ActiveElement | undefined {
	const schema = resolveSchemaForSelection(selectedSchemaId);
	if (!schema) {
		message.error(`Schema '${selectedSchemaId}' nicht gefunden.`);
		return undefined;
	}

	const target = resolveCreateTargetForSchema(schema);

	if (target === "view") {
		const view = rootStore.views.create(selectedSchemaId);
		rootStore.ui.setActiveElement(view);
		return view;
	}

	if (target === "group") {
		const group = rootStore.groups.create(selectedSchemaId, parentElement!);
		rootStore.ui.setActiveElement(group);
		return group;
	}

	if (target === "asset") {
		const asset = rootStore.assets.create(selectedSchemaId, parentElement!);
		rootStore.ui.setActiveElement(asset);
		return asset;
	}

	message.error(`Schema '${selectedSchemaId}' (${schema.baseType}/${schema.type}) nicht anlegbar.`);
	console.error("SchemaSelectionDialog - invalid schema target", schema);
	return undefined;
}

function extractSchemaData(
	schemaList: ISchemaModel[],
	parentType: string | null,
	createTargetFilter: ElementCreateTarget | "viewOrGroup"
): SchemaData[] {
	return schemaList
		.filter((item) => {
			if (!item.parent || parentType == null) {
				return false;
			}
			if (
				!isParentTypeInSchemaWhitelist(parentType, item.parent?.whitelist) ||
				isParentTypeInSchemaBlacklist(parentType, item.parent?.blacklist)
			) {
				return false;
			}
			const target = resolveCreateTargetForSchema(item);
			if (createTargetFilter === "viewOrGroup") {
				return target === "view" || target === "group";
			}
			return target === createTargetFilter;
		})
		.map((item) => ({
			schemaType: item.type,
			baseType: item.baseType,
			key: item.id,
			name: getLanguageText(item.name),
			description: getLanguageText(item.description),
			svgIcon: item.style.treeIcon,
			createTarget: resolveCreateTargetForSchema(item),
		}));
}

const SchemaSelectionDialog: React.FC<SchemaSelectionDialogProps> = ({
	visible,
	element,
	onCancel,
	onOk,
}) => {
	const langtext = useLangtext();
	const [activeTab, setActiveTab] = useState<CreateTabKey>("structure");
	const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
	const [dataSource, setDataSource] = useState<SchemaData[]>([]);
	const navigate = useNavigate();

	const parentType = isTreeElement(element)
		? resolveElementSchemaParentType(element.definition)
		: null;

	const structureSchemas = useMemo(
		() =>
			extractSchemaData(
				rootStore.configSchemas.schemaCompat,
				parentType,
				"viewOrGroup"
			),
		[visible, element, parentType]
	);

	const componentSchemas = useMemo(
		() =>
			extractSchemaData(rootStore.configSchemas.schemaCompat, parentType, "asset"),
		[visible, element, parentType]
	);

	useEffect(() => {
		if (!isTreeElement(element)) {
			setDataSource([]);
			return;
		}
		setDataSource(activeTab === "structure" ? structureSchemas : componentSchemas);
		setSelectedRowKey(null);
	}, [visible, element, activeTab, structureSchemas, componentSchemas]);

	const columns = [
		{
			title: "Symbol",
			dataIndex: "svgIcon",
			key: "svgIcon",
			render: (svgString: string, record: SchemaData) => (
				<Tooltip title={record.schemaType}>
					<SchemaSvgIcon
						svgString={svgString}
						element={{
							baseType: record.baseType,
							type: record.schemaType,
							schemaType: record.schemaType,
						}}
					/>
				</Tooltip>
			),
		},
		{
			title: "Kategorie",
			dataIndex: "createTarget",
			key: "createTarget",
			render: (target: ElementCreateTarget) => (
				<Tag color={target === "asset" ? "gold" : "blue"}>
					{target === "asset" ? "COMPONENT" : target === "view" ? "VIEW" : "VIEWGROUP"}
				</Tag>
			),
		},
		{
			title: "Name",
			dataIndex: "name",
			key: "name",
		},
		{
			title: "Schema-Typ",
			dataIndex: "schemaType",
			key: "schemaType",
		},
		{
			title: "Beschreibung",
			dataIndex: "description",
			key: "description",
		},
	];

	const rowSelection: any = {
		type: "radio",
		selectedRowKeys: selectedRowKey !== null ? [selectedRowKey] : [],
		onChange: (selectedKeys: (string | number)[]) => {
			setSelectedRowKey(selectedKeys[0] as string);
		},
	};

	const handleRowSelect = (record: SchemaData) => {
		setSelectedRowKey(record.key);
	};

	if (!isTreeElement(element)) {
		return null;
	}

	return (
		<Modal
			width="50%"
			style={{ minWidth: 600 }}
			title={
				"Select Item for adding next to '" +
				element.definition.name +
				"' [" +
				element.definition.type +
				"/" +
				element.definition.subType +
				"]"
			}
			open={visible}
			onCancel={onCancel}
			onOk={() => {
				if (selectedRowKey === null) {
					return;
				}
				const created = createNewElement(element, selectedRowKey);
				onOk(selectedRowKey);
				if (created) {
					const viewId = rootStore.ui.activeView?.id;
					if (viewId && created.class !== "View") {
						navigate(`/${authStore.getDomain()}/am/${viewId}/element/${created.id}`);
					} else if (created.class === "View") {
						navigate(`/${authStore.getDomain()}/am/${created.id}`);
					}
				}
			}}
		>
			<Tabs
				activeKey={activeTab}
				onChange={(key) => setActiveTab(key as CreateTabKey)}
				items={[
					{
						key: "structure",
						label: langtext("general.create_tab_structure"),
						children: (
							<Table
								className="schema-selection-table schema-selection-table--structure"
								rowKey="key"
								rowSelection={rowSelection}
								columns={columns}
								dataSource={dataSource}
								pagination={false}
								onRow={(record) => ({
									onClick: () => handleRowSelect(record),
								})}
								locale={{ emptyText: langtext("general.create_tab_structure_empty") }}
							/>
						),
					},
					{
						key: "component",
						label: langtext("general.create_tab_components"),
						children: (
							<Table
								className="schema-selection-table schema-selection-table--component"
								rowKey="key"
								rowSelection={rowSelection}
								columns={columns}
								dataSource={dataSource}
								pagination={false}
								onRow={(record) => ({
									onClick: () => handleRowSelect(record),
								})}
								locale={{ emptyText: langtext("general.create_tab_components_empty") }}
							/>
						),
					},
				]}
			/>
		</Modal>
	);
};

export default SchemaSelectionDialog;
