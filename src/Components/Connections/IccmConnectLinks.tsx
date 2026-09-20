import React, { useEffect, useState } from "react";
import { Space, Typography, message } from "antd";
import { observer } from "mobx-react";
import { IConnection } from "../../Stores/Models/Connection.Model";
import { rootStore } from "../../Stores/Root.Store";
import { useLangtext } from "../../lib/common";
import { encryptIccmTarget, launchConnectionIccm, iccmUserErrorText } from "../../lib/iccmLaunch";
import { buildIccmTargetUrl, resolveConnectionConnectTarget } from "../../lib/iccmConnectTarget";
import IccmOpenLink from "./IccmOpenLink";

function iccmErrorText(error: unknown, langtext: (key: string) => string): string {
	return iccmUserErrorText(error, langtext);
}

const IccmConnectLinks: React.FC<{
	connection: IConnection;
}> = observer(({ connection }) => {
	const langtext = useLangtext();
	const assets = rootStore.assets.assets.slice();
	const publicKey = rootStore.userSettings.settings.publicKey;
	const target = resolveConnectionConnectTarget(connection, assets);
	const targetUrl = target ? buildIccmTargetUrl(target) : null;
	const link = connection.links[0];
	const [href, setHref] = useState<string>();
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setBusy(true);
		setHref(undefined);

		void (async () => {
			try {
				if (!target) {
					return;
				}
				const nextHref = await encryptIccmTarget(target);
				if (!cancelled) {
					setHref(nextHref);
				}
			} catch (error) {
				if (!cancelled) {
					message.error(iccmErrorText(error, langtext));
				}
			} finally {
				if (!cancelled) {
					setBusy(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [
		connection.id,
		target?.host,
		target?.path,
		target?.username,
		target?.password,
		target?.scheme,
		publicKey,
		langtext,
	]);

	return (
		<ul className="connection-links-panel__list">
			<li>
				<Space align="start" wrap>
					<span>{langtext("general.connection_dialog_uri_from")}</span>
					<span>{link?.fromLabelSnapshot || link?.fromComponentRef || "—"}</span>
				</Space>
			</li>
			<li>
				<Space align="start" wrap>
					<span>{langtext("general.connection_dialog_uri_to")}</span>
					<span>{link?.toLabelSnapshot || link?.toComponentRef || "—"}</span>
				</Space>
			</li>
			<li>
				<Space align="start" wrap>
					<span>{langtext("general.connection_dialog_uri_target")}</span>
					{targetUrl ? (
						<Typography.Text code>{targetUrl}</Typography.Text>
					) : (
						<span style={{ opacity: 0.75 }}>{langtext("general.iccm_no_host")}</span>
					)}
				</Space>
			</li>
			{target?.username ? (
				<li>
					<Space align="start" wrap>
						<span>{langtext("general.connection_dialog_uri_user")}</span>
						<span>{target.username}</span>
					</Space>
				</li>
			) : null}
			<li>
				<Space align="start" wrap>
					<span>{langtext("general.iccm_connection_link")}</span>
					{href ? (
						<IccmOpenLink href={href} />
					) : (
						<span style={{ opacity: 0.75 }}>
							{busy ? "…" : langtext("general.iccm_no_host")}
						</span>
					)}
				</Space>
			</li>
		</ul>
	);
});

export async function launchIccmConnection(connection: IConnection, langtext: (key: string) => string) {
	try {
		await launchConnectionIccm(connection);
	} catch (error) {
		message.error(iccmErrorText(error, langtext));
	}
}

export { iccmErrorText };
export default IccmConnectLinks;
