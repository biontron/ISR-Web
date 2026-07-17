/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { useMemo } from "react";
import { Modal, Typography, message } from "antd";
import { useLangtext } from "../../lib/common";
import { JsonInspectTarget } from "../../lib/jsonInspectResolve";
import { collectChangedJsonPaths } from "../../lib/jsonDiffPaths";
import DetailPanelShell from "./DetailPanelShell";
import JsonInspectTree from "./JsonInspectTree";

interface JsonInspectDialogProps {
	open: boolean;
	target: JsonInspectTarget | null;
	onClose: () => void;
}

function JsonInspectPanelBody({
	target,
	baseline,
	current,
	changedPaths,
}: {
	target: JsonInspectTarget;
	baseline: unknown;
	current: unknown;
	changedPaths: Set<string>;
}) {
	const langtext = useLangtext();

	return (
		<div className="json-inspect-dialog-body">
			<Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
				{`${langtext("general.json_inspect_kind")}: ${target.kind}`}
			</Typography.Text>
			{baseline && changedPaths.size > 0 ? (
				<Typography.Text style={{ display: "block", marginBottom: 12 }}>
					<span className="json-inspect-changed json-inspect-legend">
						{langtext("general.json_inspect_changed_hint")}
					</span>
				</Typography.Text>
			) : null}
			{baseline && changedPaths.size === 0 ? (
				<Typography.Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
					{langtext("general.json_inspect_no_changes")}
				</Typography.Text>
			) : null}
			<div className="json-inspect-panel">
				<JsonInspectTree value={current} path="" changedPaths={changedPaths} />
			</div>
		</div>
	);
}

const JsonInspectDialog: React.FC<JsonInspectDialogProps> = ({ open, target, onClose }) => {
	const langtext = useLangtext();
	const baseline = target?.baseline;
	const current = target?.current;

	const changedPaths = useMemo(() => {
		if (!baseline) {
			return new Set<string>();
		}
		return collectChangedJsonPaths(baseline, current);
	}, [baseline, current]);

	const handleCopy = async () => {
		const text = JSON.stringify(current ?? {}, null, 2);
		try {
			await navigator.clipboard.writeText(text);
			message.success(langtext("general.json_inspect_copy_success"));
		} catch {
			message.error(langtext("general.json_inspect_copy_failed"));
		}
	};

	return (
		<Modal
			open={open}
			title={null}
			onCancel={onClose}
			footer={null}
			closable={false}
			width={900}
			destroyOnClose
			className="detail-panel-modal"
		>
			{target ? (
				<DetailPanelShell
					title={`${langtext("general.json_inspect_title")}: ${target.title}`}
					onCopy={handleCopy}
					onClose={onClose}
				>
					<JsonInspectPanelBody
						target={target}
						baseline={baseline}
						current={current}
						changedPaths={changedPaths}
					/>
				</DetailPanelShell>
			) : null}
		</Modal>
	);
};

export default JsonInspectDialog;
