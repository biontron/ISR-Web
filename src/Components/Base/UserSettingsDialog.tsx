/*
# SPDX-License-Identifier: GPL-2.0
*/
import React, { useEffect, useState } from "react";
import { Alert, Button, Input, Modal, Space } from "antd";
import { observer } from "mobx-react";
import { rootStore } from "../../Stores/Root.Store";
import { useLangtext } from "../../lib/common";
import { downloadBytesAsFile, downloadTextAsFile } from "../../lib/downloadTextAsFile";
import { patchIccmPrivSlot } from "../../lib/iccmPrivSlot";
import { generateRsaOaepKeyPairPem } from "../../lib/rsaPem";

type UserSettingsDialogProps = {
	open: boolean;
	onClose: () => void;
};

function downloadOs(): "windows" | "macos" | "linux" {
	if (/Win/i.test(navigator.userAgent)) {
		return "windows";
	}
	if (/Mac/i.test(navigator.userAgent)) {
		return "macos";
	}
	return "linux";
}

const UserSettingsDialog: React.FC<UserSettingsDialogProps> = observer(({ open, onClose }) => {
	const langtext = useLangtext();
	const store = rootStore.userSettings;
	const [busy, setBusy] = useState(false);
	const [info, setInfo] = useState("");

	useEffect(() => {
		if (!open) {
			setInfo("");
			return;
		}
		void store.load();
	}, [open, store]);

	const handleGenerate = async () => {
		setBusy(true);
		setInfo("");
		try {
			const pair = await generateRsaOaepKeyPairPem();
			store.applyKeyPair(pair.publicKey, pair.privateKey);
			setInfo(langtext("general.user_settings_generate_ok"));
		} catch (error) {
			store.setError(error instanceof Error ? error.message : String(error));
		} finally {
			setBusy(false);
		}
	};

	const handleSave = async () => {
		setBusy(true);
		setInfo("");
		const ok = await store.save();
		if (ok) {
			setInfo(langtext("general.user_settings_save_ok"));
		}
		setBusy(false);
	};

	const handleDownloadPem = () => {
		if (!store.settings.privateKey.trim()) {
			setInfo(langtext("general.user_settings_pem_missing"));
			return;
		}
		downloadTextAsFile("client-private.pem", store.settings.privateKey, "application/x-pem-file");
	};

	const handleEmbed = async () => {
		if (!store.settings.privateKey.trim()) {
			setInfo(langtext("general.user_settings_pem_missing"));
			return;
		}
		setBusy(true);
		setInfo("");
		const filename = `service-invoker-service-${downloadOs()}`;
		try {
			const response = await fetch(`/app/download/${filename}`);
			if (!response.ok) {
				throw new Error(`${response.status} ${response.statusText}`);
			}
			const bytes = new Uint8Array(await response.arrayBuffer());
			const patched = patchIccmPrivSlot(bytes, store.settings.privateKey);
			downloadBytesAsFile(filename, patched);
			setInfo(langtext("general.user_settings_embed_ok"));
		} catch (error) {
			store.setError(error instanceof Error ? error.message : String(error));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal
			open={open}
			title={langtext("general.user_settings")}
			onCancel={onClose}
			width={720}
			footer={
				<Space>
					<Button onClick={onClose}>{langtext("general.cancel")}</Button>
					<Button type="primary" loading={busy || store.loading} onClick={() => void handleSave()}>
						{langtext("general.save")}
					</Button>
				</Space>
			}
		>
			<Space direction="vertical" style={{ width: "100%" }} size="middle">
				{store.error ? (
					<Alert type="error" showIcon message={store.error.message} />
				) : null}
				{info ? <Alert type="success" showIcon message={info} /> : null}
				<div>
					<div>{langtext("general.user_settings_public_key")}</div>
					<Input.TextArea
						value={store.settings.publicKey}
						onChange={(event) => store.setPublicKey(event.target.value)}
						autoSize={{ minRows: 4, maxRows: 8 }}
						spellCheck={false}
					/>
				</div>
				<div>
					<div>{langtext("general.user_settings_private_key")}</div>
					<Input.TextArea
						value={store.settings.privateKey}
						onChange={(event) => store.setPrivateKey(event.target.value)}
						autoSize={{ minRows: 4, maxRows: 8 }}
						spellCheck={false}
					/>
				</div>
				<Space wrap>
					<Button loading={busy} onClick={() => void handleGenerate()}>
						{langtext("general.user_settings_generate")}
					</Button>
					<Button onClick={handleDownloadPem}>
						{langtext("general.user_settings_download_pem")}
					</Button>
					<Button loading={busy} onClick={() => void handleEmbed()}>
						{langtext("general.user_settings_embed_binary")}
					</Button>
				</Space>
				<div>{langtext("general.user_settings_embed_hint")}</div>
			</Space>
		</Modal>
	);
});

export default UserSettingsDialog;
