/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0
*/

import { IAsset } from "../Stores/Models/Asset.Model";
import { IConnection } from "../Stores/Models/Connection.Model";
import { rootStore } from "../Stores/Root.Store";
import { buildIccmEncHref, IccmLegacyConnection } from "./iccmConnectLink";
import { resolveAssetConnectTarget, resolveConnectionConnectTarget } from "./iccmConnectTarget";
import { isUsablePublicKeyPem } from "./rsaPem";

export class IccmLaunchError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "IccmLaunchError";
	}
}

export async function loadUserPublicKeyPem(): Promise<string> {
	const store = rootStore.userSettings;
	if (!isUsablePublicKeyPem(store.settings.publicKey)) {
		await store.load();
	}
	const pem = store.settings.publicKey.trim();
	if (!isUsablePublicKeyPem(pem)) {
		throw new IccmLaunchError("ICCM_NO_PUBLIC_KEY");
	}
	return pem;
}

export async function encryptIccmTarget(target: IccmLegacyConnection): Promise<string> {
	const publicKey = await loadUserPublicKeyPem();
	return buildIccmEncHref(target, publicKey);
}

export async function buildComponentIccmHref(target: IccmLegacyConnection): Promise<string> {
	return encryptIccmTarget(target);
}

export async function buildConnectionIccmHref(connection: IConnection): Promise<string> {
	const target = resolveConnectionConnectTarget(connection, rootStore.assets.assets.slice());
	if (!target) {
		throw new IccmLaunchError("ICCM_NO_HOST");
	}
	return encryptIccmTarget(target);
}

export function openIccmHref(href: string): void {
	const target = href.trim();
	if (!/^iccm:\/\/connect\?/i.test(target)) {
		return;
	}
	const anchor = document.createElement("a");
	anchor.setAttribute("href", target);
	anchor.setAttribute("rel", "noreferrer");
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
}

export async function launchComponentIccm(asset: IAsset, dockId?: string, dockpartId?: string): Promise<void> {
	const target = resolveAssetConnectTarget(asset, dockId, dockpartId);
	if (!target) {
		throw new IccmLaunchError("ICCM_NO_HOST");
	}
	openIccmHref(await buildComponentIccmHref(target));
}

export async function launchConnectionIccm(connection: IConnection): Promise<void> {
	openIccmHref(await buildConnectionIccmHref(connection));
}

export function iccmUserErrorText(error: unknown, text: (key: string) => string): string {
	const code = error instanceof Error ? error.message : "";
	if (code === "ICCM_NO_PUBLIC_KEY") {
		return text("general.iccm_no_public_key");
	}
	if (code === "ICCM_MISSING_CONTEXT") {
		return text("general.iccm_missing_context");
	}
	if (code === "ICCM_NO_HOST" || code === "ICCM_PAYLOAD_TOO_LARGE") {
		return text("general.iccm_no_host");
	}
	return error instanceof Error ? error.message : text("general.iccm_no_host");
}
