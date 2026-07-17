/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { useState } from "react";
import { Button, Space, Tooltip, message } from "antd";
import { observer } from "mobx-react";
import { rootStore } from "../../../Stores/Root.Store";
import { useLangtext } from "../../../lib/common";
import {
	canDiscardElementStatus,
	canSaveElementStatus,
	discardElement,
	saveElement,
} from "../../../lib/activityStatusActions";

const ElementPropertyActions: React.FC = observer(() => {
	const langtext = useLangtext();
	const { activeElement, isReadOnly } = rootStore.ui;
	const [saving, setSaving] = useState(false);

	if (!activeElement || isReadOnly) {
		return null;
	}

	const canSave = canSaveElementStatus(activeElement.status);
	const canDiscard = canDiscardElementStatus(activeElement.status);
	const showEditStart =
		activeElement.status !== "edit" &&
		activeElement.status !== "changed" &&
		activeElement.status !== "new" &&
		activeElement.status !== "deleted";

	const handleSave = async () => {
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
		discardElement(rootStore, activeElement);
	};

	const handleSwitchToEditMode = () => {
		activeElement.beginEdit();
	};

	if (!canSave && !canDiscard && !showEditStart) {
		return null;
	}

	return (
		<div
			className="element-properties-footer"
			style={{
				marginTop: 0,
				padding: "12px 16px",
				borderTop: "1px solid #f0f0f0",
				background: "#fafafa",
			}}
		>
			<Space wrap>
				{canSave && (
					<Button type="primary" loading={saving} onClick={handleSave}>
						{langtext("general.element_save")}
					</Button>
				)}
				{canDiscard && (
					<Button onClick={handleDiscard} disabled={saving}>
						{langtext("general.element_discard")}
					</Button>
				)}
				{showEditStart && (
					<Tooltip title={langtext("general.element_edit_tooltip")}>
						<Button type="default" onClick={handleSwitchToEditMode}>
							{langtext("general.element_edit_start")}
						</Button>
					</Tooltip>
				)}
			</Space>
		</div>
	);
});

export default ElementPropertyActions;
