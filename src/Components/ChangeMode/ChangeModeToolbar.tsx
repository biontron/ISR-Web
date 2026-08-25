/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { Fragment, useState } from "react";
import { Badge, Button, Space, Tooltip, message } from "antd";
import {
	PlusOutlined,
	EditOutlined,
	SaveOutlined,
	DeleteOutlined,
	UndoOutlined,
	CodeOutlined,
	UnorderedListOutlined,
} from "@ant-design/icons";
import { observer } from "mobx-react";
import { rootStore } from "../../Stores/Root.Store";
import SchemaSelectionDialog from "../Schema/SchemaSelectionDialog";
import JsonInspectDialog from "./JsonInspectDialog";
import { useLangtext } from "../../lib/common";
import { hasTouchedObjects } from "../../lib/touchedObjects";
import { stageDelete, isNewElementStatus } from "../../lib/elementStaging";
import {
	discardElement,
	saveElement,
	shouldEnableChangeModeSave,
} from "../../lib/activityStatusActions";
import { hasJsonInspectTarget, resolveJsonInspectTarget } from "../../lib/jsonInspectResolve";
import { activityStatusOverviewUi } from "../../lib/activityStatusOverviewUi";
import { getElementDisplayName } from "../../Interfaces/Element";
import { buildActivityStatusBadgeCount } from "../../lib/activityStatusOverview";

const iconGroupGap: React.CSSProperties = { marginLeft: 8 };

const ChangeModeToolbar: React.FC = () => {
	const [isPopupVisible, setPopupVisible] = useState(false);
	const [jsonInspectOpen, setJsonInspectOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const { activeElement, isReadOnly } = rootStore.ui;
	const langtext = useLangtext();
	const hasTouched = hasTouchedObjects(rootStore);
	const summary = buildActivityStatusBadgeCount(rootStore);
	const jsonInspectTarget = resolveJsonInspectTarget(rootStore);
	const canJsonInspect = hasJsonInspectTarget(rootStore);
	const elementBusy =
		activeElement?.status === "new" ||
		activeElement?.status === "edit" ||
		activeElement?.status === "changed" ||
		activeElement?.status === "invalid";
	const elementEditable = !!activeElement && !isReadOnly;

	const handleCreate = () => {
		setPopupVisible(true);
	};

	const handleEdit = () => {
		if (activeElement && !isReadOnly) {
			activeElement.beginEdit();
		}
	};

	const canSaveToolbar = shouldEnableChangeModeSave(activeElement?.status);

	const handleSave = async () => {
		if (!activeElement) {
			return;
		}
		setSaving(true);
		try {
			const { saved, failed } = await saveElement(rootStore, activeElement);
			if (failed.length > 0) {
				message.error(langtext("general.activity_status_save_summary", {
					saved: String(saved),
					failed: String(failed.length),
				}));
			} else if (saved > 0) {
				message.success(langtext("general.element_save"));
			}
		} finally {
			setSaving(false);
		}
	};

	const handleDiscard = () => {
		if (activeElement) {
			discardElement(rootStore, activeElement);
		}
	};

	const handleDelete = () => {
		if (!activeElement) return;

		if (isNewElementStatus(activeElement.status, activeElement.statusBeforeInvalid)) {
			switch (activeElement.class) {
				case "View":
					rootStore.views.removeLocal(activeElement as any);
					break;
				case "Group":
					rootStore.groups.removeLocal(activeElement as any);
					break;
				case "Asset":
					rootStore.assets.removeLocal(activeElement as any);
					break;
				case "Connection": {
					const conn = rootStore.connections.connections.find(
						(c) => c.id === activeElement.id
					);
					if (conn) {
						rootStore.connections.removeLocal(conn);
					}
					break;
				}
			}
			return;
		}

		stageDelete(activeElement);
	};

	const handleChangeModeToggle = () => {
		if (isReadOnly) {
			rootStore.ui.exitReadOnlyMode();
			return;
		}
		if (hasTouched) {
			activityStatusOverviewUi.show("write", { unsavedHint: true });
			return;
		}
		rootStore.ui.enterReadOnlyMode();
	};

	return (
		<Fragment>
			<SchemaSelectionDialog
				visible={isPopupVisible}
				element={activeElement}
				onCancel={() => setPopupVisible(false)}
				onOk={() => setPopupVisible(false)}
			/>

			<JsonInspectDialog
				open={jsonInspectOpen}
				target={jsonInspectTarget}
				onClose={() => setJsonInspectOpen(false)}
			/>

			<Space align="center" size={0} wrap className="change-mode-toolbar">
				<Button
					className={!isReadOnly ? "EditMode" : ""}
					onClick={handleChangeModeToggle}
				>
					{isReadOnly
						? langtext("general.change_mode_activate")
						: langtext("general.change_mode_end")}
				</Button>

				{!isReadOnly && (
					<Fragment>
						<Button.Group style={iconGroupGap}>
							<Tooltip title={langtext("general.element_create")}>
								<Button
									icon={<PlusOutlined />}
									onClick={handleCreate}
									disabled={!elementEditable || elementBusy}
								/>
							</Tooltip>
							<Tooltip
								title={
									langtext("general.element_delete", {
										name: activeElement ? getElementDisplayName(activeElement) : "",
									}) + "?!"
								}
							>
								<Button
									danger
									icon={<DeleteOutlined />}
									onClick={handleDelete}
									disabled={!elementEditable || activeElement?.status === "deleted"}
								/>
							</Tooltip>
						</Button.Group>

						<Button.Group style={iconGroupGap}>
							<Tooltip
								title={
									activeElement
										? langtext("general.element_edit", {
											name: getElementDisplayName(activeElement),
										})
										: langtext("general.element_edit_tooltip")
								}
							>
								<Button
									icon={<EditOutlined />}
									onClick={handleEdit}
									disabled={
										!elementEditable ||
										elementBusy ||
										activeElement?.status === "deleted"
									}
								/>
							</Tooltip>
							<Tooltip title={langtext("general.element_save")}>
								<Button
									icon={<SaveOutlined />}
									onClick={handleSave}
									loading={saving}
									disabled={!elementEditable || saving || !canSaveToolbar}
								/>
							</Tooltip>
							<Tooltip title={langtext("general.element_discard")}>
								<Button
									icon={<UndoOutlined />}
									onClick={handleDiscard}
									disabled={!elementEditable || saving || !canSaveToolbar}
								/>
							</Tooltip>
						</Button.Group>
					</Fragment>
				)}

				<Button.Group style={iconGroupGap}>
					<Tooltip title={langtext("general.json_inspect")}>
						<Button
							icon={<CodeOutlined />}
							onClick={() => setJsonInspectOpen(true)}
							disabled={!canJsonInspect}
						/>
					</Tooltip>
				</Button.Group>

				<Tooltip title={langtext("general.activity_status_overview_title")}>
					<Badge
						className="change-mode-overview-badge"
						count={summary.total}
						size="small"
						offset={[4, -2]}
						overflowCount={99}
					>
						<Button
							style={iconGroupGap}
							icon={<UnorderedListOutlined />}
							onClick={() =>
								activityStatusOverviewUi.show(
									summary.readErrors > 0 && summary.touchedCount === 0
										? "read"
										: "write"
								)
							}
						/>
					</Badge>
				</Tooltip>
			</Space>
		</Fragment>
	);
};

export default observer(ChangeModeToolbar);
