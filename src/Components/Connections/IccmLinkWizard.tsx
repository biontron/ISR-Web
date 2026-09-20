import React, { useEffect, useMemo, useState } from "react";
import { Form, Input, InputNumber, Modal, Select, Space, Typography, message } from "antd";
import { IccmLegacyConnection } from "../../lib/iccmConnectLink";
import { buildIccmTargetUrl } from "../../lib/iccmConnectTarget";
import { encryptIccmTarget, iccmUserErrorText } from "../../lib/iccmLaunch";
import {
	IccmDockPreset,
	defaultPortForIccmType,
	formatIccmNoteSnippet,
	schemeForIccmType,
} from "../../lib/iccmNoteLink";
import { useLangtext } from "../../lib/common";

const ICCM_TYPES: IccmLegacyConnection["type"][] = ["browser", "ssh", "scp"];

type WizardDraft = {
	label: string;
	type: IccmLegacyConnection["type"];
	host: string;
	port?: number;
	path: string;
	username: string;
	password: string;
};

function draftFromTarget(target?: IccmLegacyConnection): WizardDraft {
	return {
		label: target?.label ?? "",
		type: target?.type && target.type !== "generic" ? target.type : "browser",
		host: target?.host ?? "",
		port: target?.port ?? 443,
		path: target?.path ?? "",
		username: target?.username ?? "",
		password: target?.password ?? "",
	};
}

function draftToTarget(draft: WizardDraft): IccmLegacyConnection | null {
	const host = draft.host.trim();
	if (!host) {
		return null;
	}
	return {
		label: draft.label.trim() || host,
		type: draft.type,
		host,
		port: draft.port,
		path: draft.path.trim() || undefined,
		username: draft.username.trim() || undefined,
		password: draft.password.trim() || undefined,
		scheme: schemeForIccmType(draft.type),
	};
}

type IccmLinkWizardProps = {
	open: boolean;
	presets?: IccmDockPreset[];
	onCancel: () => void;
	onInsert: (snippet: string) => void;
};

const IccmLinkWizard: React.FC<IccmLinkWizardProps> = ({ open, presets = [], onCancel, onInsert }) => {
	const langtext = useLangtext();
	const [draft, setDraft] = useState<WizardDraft>(draftFromTarget());
	const [presetKey, setPresetKey] = useState<string>();
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!open) {
			return;
		}
		setDraft(draftFromTarget());
		setPresetKey(undefined);
		setBusy(false);
	}, [open]);

	const target = useMemo(() => draftToTarget(draft), [draft]);
	const previewUrl = target ? buildIccmTargetUrl(target) : null;

	const handleTypeChange = (type: IccmLegacyConnection["type"]) => {
		setDraft((current) => ({
			...current,
			type,
			port: defaultPortForIccmType(type),
		}));
	};

	const handlePreset = (key: string) => {
		setPresetKey(key);
		const preset = presets.find((entry) => entry.key === key);
		if (preset) {
			setDraft(draftFromTarget(preset.target));
		}
	};

	const handleInsert = async () => {
		if (!target) {
			message.error(langtext("general.iccm_wizard_host_required"));
			return;
		}
		setBusy(true);
		try {
			const href = await encryptIccmTarget(target);
			onInsert(formatIccmNoteSnippet(target, href));
		} catch (error) {
			message.error(iccmUserErrorText(error, langtext));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal
			open={open}
			title={langtext("general.iccm_wizard_title")}
			onCancel={onCancel}
			okText={langtext("general.iccm_wizard_insert")}
			okButtonProps={{ disabled: !target, loading: busy }}
			onOk={() => void handleInsert()}
			destroyOnClose
			width={520}
		>
			<Form layout="vertical">
				{presets.length > 0 ? (
					<Form.Item label={langtext("general.iccm_wizard_from_dock")}>
						<Select
							allowClear
							value={presetKey}
							placeholder={langtext("general.iccm_wizard_from_dock")}
							options={presets.map((preset) => ({ value: preset.key, label: preset.label }))}
							onChange={(value) => {
								if (!value) {
									setPresetKey(undefined);
									return;
								}
								handlePreset(value);
							}}
						/>
					</Form.Item>
				) : null}
				<Form.Item label={langtext("general.iccm_wizard_label")}>
					<Input
						value={draft.label}
						onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
					/>
				</Form.Item>
				<Form.Item label={langtext("general.iccm_wizard_type")}>
					<Select
						value={draft.type}
						options={ICCM_TYPES.map((type) => ({ value: type, label: type }))}
						onChange={handleTypeChange}
					/>
				</Form.Item>
				<Form.Item label={langtext("general.iccm_wizard_host")} required>
					<Input
						value={draft.host}
						onChange={(event) => setDraft((current) => ({ ...current, host: event.target.value }))}
					/>
				</Form.Item>
				<Space.Compact style={{ width: "100%" }}>
					<Form.Item label={langtext("general.iccm_wizard_port")} style={{ flex: 1 }}>
						<InputNumber
							style={{ width: "100%" }}
							min={1}
							max={65535}
							value={draft.port}
							onChange={(value) =>
								setDraft((current) => ({ ...current, port: value ?? undefined }))
							}
						/>
					</Form.Item>
					<Form.Item label={langtext("general.iccm_wizard_path")} style={{ flex: 2 }}>
						<Input
							value={draft.path}
							onChange={(event) => setDraft((current) => ({ ...current, path: event.target.value }))}
						/>
					</Form.Item>
				</Space.Compact>
				<Form.Item label={langtext("general.iccm_wizard_username")}>
					<Input
						value={draft.username}
						onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))}
					/>
				</Form.Item>
				<Form.Item label={langtext("general.iccm_wizard_password")}>
					<Input.Password
						value={draft.password}
						onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))}
					/>
				</Form.Item>
				<Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
					{langtext("general.iccm_wizard_preview")}: {previewUrl || "—"}
				</Typography.Paragraph>
			</Form>
		</Modal>
	);
};

export default IccmLinkWizard;
