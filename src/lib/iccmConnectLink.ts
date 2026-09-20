/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0
*/

import { encryptUtf8ToBase64 } from "./rsaPem";

/** RSA-4096 OAEP SHA-256: 512 − 2×32 − 2 = 446 Byte Klartext. */
export const ICCM_RSA_OAEP_MAX_PLAIN_BYTES = 446;

export type IccmLegacyConnection = {
	label: string;
	type: "browser" | "ssh" | "scp" | "generic";
	host: string;
	port?: number;
	username?: string;
	password?: string;
	path?: string;
	/** https / http / ssh / scp — für Ziel-URL wie https://google.com/irgendwo */
	scheme?: string;
};

export type IccmFetchConnect = {
	server: string;
	url: string;
	accessToken: string;
	handleId: string;
	validTill: string;
};

export function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function utf8ByteLength(value: string): number {
	return new TextEncoder().encode(value).length;
}

function optionalXml(name: string, value: string | number | undefined): string {
	if (value == null || value === "") {
		return "";
	}
	return `<${name}>${escapeXml(String(value))}</${name}>`;
}

/** Legacy-Klartext für iccm://connect?enc= — wie test_crypto.xqy. */
export function serializeLegacyConnectionXml(connection: IccmLegacyConnection): string {
	return (
		`<connection>` +
		`<label>${escapeXml(connection.label)}</label>` +
		`<type>${escapeXml(connection.type)}</type>` +
		`<host>${escapeXml(connection.host)}</host>` +
		optionalXml("port", connection.port) +
		optionalXml("username", connection.username) +
		optionalXml("password", connection.password) +
		optionalXml("path", connection.path) +
		optionalXml("scheme", connection.scheme) +
		`</connection>`
	);
}

/** Fetch-Ticket für iccm://connect?fetch= — wie test_crypto.xqy. */
export function serializeFetchConnectXml(connect: IccmFetchConnect): string {
	return (
		`<connect server="${escapeXml(connect.server)}" url="${escapeXml(connect.url)}">` +
		`<accessToken validTill="${escapeXml(connect.validTill)}">${escapeXml(connect.accessToken)}</accessToken>` +
		`<handles>` +
		`<handle id="${escapeXml(connect.handleId)}" validTill="${escapeXml(connect.validTill)}" order="1"/>` +
		`</handles>` +
		`</connect>`
	);
}

export function parseApiRoot(apiRoot: string): { server: string; apiPath: string } {
	const parsed = new URL(apiRoot);
	const apiPath = parsed.pathname.replace(/\/+$/, "") || "/api";
	return { server: parsed.origin, apiPath };
}

export function iccmConnectFetchPath(apiRoot: string, domain: string): { server: string; url: string } {
	const { server, apiPath } = parseApiRoot(apiRoot);
	return {
		server,
		url: `${apiPath}/${domain}/connect`,
	};
}

export function iccmConnectHandle(usernameHex: string, environmentId: string, connectionId: string): string {
	return `${usernameHex}--${environmentId}--${connectionId}`;
}

export function parseIccmConnectHandle(
	handle: string
): { usernameHex: string; environmentId: string; connectionId: string } | null {
	const parts = handle.split("--");
	if (parts.length !== 3 || parts.some((part) => !part)) {
		return null;
	}
	return { usernameHex: parts[0], environmentId: parts[1], connectionId: parts[2] };
}

export function iccmValidTill(from = new Date(), hours = 24): string {
	const until = new Date(from.getTime() + hours * 60 * 60 * 1000);
	return until.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function buildIccmHref(queryName: "enc" | "fetch", encryptedBase64: string, timestamp: string): string {
	const enc = encodeURIComponent(encryptedBase64);
	const ts = encodeURIComponent(timestamp);
	return `iccm://connect?${queryName}=${enc}&ts=${ts}&v=1`;
}

async function encryptPlainToHref(
	queryName: "enc" | "fetch",
	plainXml: string,
	publicKeyPem: string,
	timestamp: string
): Promise<string> {
	if (utf8ByteLength(plainXml) > ICCM_RSA_OAEP_MAX_PLAIN_BYTES) {
		throw new Error("ICCM_PAYLOAD_TOO_LARGE");
	}
	const encrypted = await encryptUtf8ToBase64(publicKeyPem, plainXml);
	return buildIccmHref(queryName, encrypted, timestamp);
}

export async function buildIccmEncHref(
	connection: IccmLegacyConnection,
	publicKeyPem: string,
	timestamp = iccmValidTill()
): Promise<string> {
	return encryptPlainToHref("enc", serializeLegacyConnectionXml(connection), publicKeyPem, timestamp);
}

export async function buildIccmFetchHref(
	connect: IccmFetchConnect,
	publicKeyPem: string,
	timestamp = connect.validTill
): Promise<string> {
	return encryptPlainToHref("fetch", serializeFetchConnectXml(connect), publicKeyPem, timestamp);
}
