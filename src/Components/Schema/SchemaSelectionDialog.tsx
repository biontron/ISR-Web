/*
# SPDX-License-Identifier: GPL-2.0*/

import { Modal, Select, Table, Tabs, Tag, message } from "antd";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { rootStore } from "../../Stores/Root.Store";
import authStore from "../../Stores/Auth.Store";
import { ActiveElement, isTreeElement } from "../../Interfaces/Element";
import { ISchemaModel } from "../../Stores/Models/Schema.Model";
import SchemaSvgIcon from "../Schema/SchemaSvgIcon";
import ElementDefinitionHoverTooltip from "./ElementDefinitionHoverTooltip";
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
import { environmentDisplayName } from "../../Stores/Models/Environment.Model";
import {
	readViewEnvironmentBindings,
	resolveCreateEnvironmentTarget,
	resolveWriteEnvironmentId,
	knownEnvironmentIds,
} from "../../lib/viewEnvironments";
import { CreateTabKey, resolveCreateDialogTab } from "../../lib/schemaSelectionDialogTab";

interface SchemaSelectionDialogProps {
	visible: boolean;
	element: ActiveElement;
	onCancel: () => void;
	onOk: (selectedKey: string | null) => void;
}

interface SchemaData {
	schemaType: string;
	baseType: string;
	subType: string;
	key: string;
	name: string;
	description: string;
	svgIcon: string;
	createTarget: ElementCreateTarget;
}

function resolveSchemaForSelection(selectedSchemaId: string): ISchemaModel | undefined {
	return (
		rootStore.configSchemas.findSchemaById(selectedSchemaId) ??
		rootStore.configSchemas.schemaCompat.find((item) => item.id === selectedSchemaId)
	);
}

function createNewElement(
	parentElement: ActiveElement,
	selectedSchemaId: string,
	environmentId?: string
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
		const targetEnv = resolveCreateEnvironmentTarget(
			rootStore.ui.activeView,
			environmentId,
			knownEnvironmentIds(rootStore)
		);
		if (!targetEnv) {
			message.error("Kein gültiges Environment. Bitte zuerst Environments laden und an die View binden.");
			return undefined;
		}
		const asset = rootStore.assets.create(selectedSchemaId, parentElement!, targetEnv);
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
			subType: item.subType,
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
	const [targetEnvironmentId, setTargetEnvironmentId] = useState("");
	const navigate = useNavigate();
	const knownIds = knownEnvironmentIds(rootStore);
	const boundKnown = readViewEnvironmentBindings(rootStore.ui.activeView).filter((entry) =>
		knownIds.includes(entry.ref)
	);
	const environmentChoices =
		boundKnown.length > 0 ? boundKnown : knownIds.map((id) => ({ ref: id }));
	const showEnvironmentPicker = environmentChoices.length > 1;

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

	useEffect(() => {
		if (!visible) {
			return;
		}
		setActiveTab(resolveCreateDialogTab(structureSchemas.length));
		setTargetEnvironmentId(
			resolveWriteEnvironmentId(knownEnvironmentIds(rootStore), rootStore.ui.activeView)
		);
	}, [visible, structureSchemas.length]);

	const columns = [
		{
			title: "Symbol",
			dataIndex: "svgIcon",
			key: "svgIcon",
			render: (svgString: string, record: SchemaData) => (
				<ElementDefinitionHoverTooltip
					fields={{
						id: record.key,
						baseType: record.baseType,
						type: record.schemaType,
						subType: record.subType,
						name: record.name,
						label: record.name,
						description: record.description,
						className:
							record.createTarget === "asset"
								? "Asset"
								: record.createTarget === "view"
									? "View"
									: "Group",
					}}
				>
					<SchemaSvgIcon
						svgString={svgString}
						element={{
							baseType: record.baseType,
							type: record.schemaType,
							subType: record.subType,
							schemaType: record.schemaType,
							name: record.name,
							label: record.name,
						}}
					/>
				</ElementDefinitionHoverTooltip>
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
			title={langtext("general.create_dialog_title", {
				name: element.definition.name,
				type: element.definition.type,
				subType: element.definition.subType ?? "",
			})}
			open={visible}
			onCancel={onCancel}
			onOk={() => {
				if (selectedRowKey === null) {
					return;
				}
				if (
					showEnvironmentPicker &&
					activeTab === "component" &&
					!targetEnvironmentId
				) {
					message.error(langtext("general.create_environment_target_required"));
					return;
				}
				const created = createNewElement(element, selectedRowKey, targetEnvironmentId);
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
			{showEnvironmentPicker && activeTab === "component" ? (
				<div style={{ marginBottom: 16 }}>
					<label style={{ display: "block", marginBottom: 8 }}>
						{langtext("general.create_environment_target")}
					</label>
					<Select
						style={{ width: "100%" }}
						value={targetEnvironmentId || undefined}
						placeholder={langtext("general.create_environment_target")}
						onChange={(value) => setTargetEnvironmentId(value)}
						options={environmentChoices.map((entry) => {
							const environment = rootStore.environments.findById(entry.ref);
							return {
								value: entry.ref,
								label: environment ? environmentDisplayName(environment) : entry.ref,
							};
						})}
					/>
				</div>
			) : null}
			<Tabs
				activeKey={activeTab}
				onChange={(key) => setActiveTab(key as CreateTabKey)}
				items={[
					{
						key: "structure",
						label: langtext("general.create_tab_structure"),
						disabled: structureSchemas.length === 0,
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
