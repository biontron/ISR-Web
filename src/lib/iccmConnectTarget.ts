/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0
*/

import { parseDockEndpointRef, parseDockRef } from "./connectionEndpointRef";
import { resolveConnectionDirection } from "./connectionDirection";
import { IccmLegacyConnection } from "./iccmConnectLink";

type SettingsReader = { get(key: string): unknown };

export type ConnectableDockpart = {
	id: string;
	type?: string;
	protocol?: string;
	basedOn?: Array<{ dockpartId: string | number }>;
	settings?: SettingsReader;
};

export type ConnectableDock = {
	id: string;
	hints?: Array<{ value?: string }>;
	dockparts: ConnectableDockpart[];
};

export type ConnectableAsset = {
	id: string;
	definition?: { name?: string; label?: string };
	docks: ConnectableDock[];
};

export type ConnectableConnection = {
	links: Array<{
		fromComponentRef?: string | null;
		toComponentRef?: string | null;
		fromDockRef?: string;
		toDockRef?: string;
		direction?: string | null;
		linkparts: Array<{ fromDockpartRef?: string; toDockpartRef?: string }>;
		credentials?: unknown;
	}>;
};

function readSetting(part: ConnectableDockpart, key: string): string {
	const value = part.settings?.get(key);
	if (value == null) {
		return "";
	}
	return String(value).trim();
}

function collectDockpartChain(dock: ConnectableDock, startId?: string): ConnectableDockpart[] {
	if (!startId) {
		return dock.dockparts.slice();
	}
	const byId = new Map(dock.dockparts.map((part) => [String(part.id), part]));
	const ordered: ConnectableDockpart[] = [];
	const seen = new Set<string>();
	const walk = (id: string) => {
		if (seen.has(id)) {
			return;
		}
		seen.add(id);
		const part = byId.get(id);
		if (!part) {
			return;
		}
		ordered.push(part);
		for (const entry of part.basedOn ?? []) {
			walk(String(entry.dockpartId));
		}
	};
	walk(startId);
	return ordered;
}

function protocolOf(part: ConnectableDockpart): string {
	return (part.protocol || part.type || "").trim().toUpperCase();
}

function iccmTypeForProtocol(protocol: string): IccmLegacyConnection["type"] {
	if (protocol === "SCP") {
		return "scp";
	}
	if (protocol === "SSH" || protocol === "SFTP") {
		return "ssh";
	}
	if (protocol === "HTTP" || protocol === "HTTPS" || protocol === "TLS" || protocol === "BROWSER") {
		return "browser";
	}
	return "generic";
}

function defaultPort(type: IccmLegacyConnection["type"], protocol: string): number | undefined {
	if (type === "ssh" || type === "scp") {
		return 22;
	}
	if (type === "browser") {
		return protocol === "HTTP" ? 80 : 443;
	}
	return undefined;
}

function schemeFor(type: IccmLegacyConnection["type"], protocol: string): string {
	if (type === "ssh") {
		return "ssh";
	}
	if (type === "scp") {
		return "scp";
	}
	if (type === "browser") {
		return protocol === "HTTP" ? "http" : "https";
	}
	return protocol.toLowerCase() || "https";
}

function splitUserPass(value: string): { username?: string; password?: string } {
	const trimmed = value.trim();
	if (!trimmed) {
		return {};
	}
	const colon = trimmed.indexOf(":");
	if (colon < 0) {
		return { username: trimmed };
	}
	return {
		username: trimmed.slice(0, colon) || undefined,
		password: trimmed.slice(colon + 1) || undefined,
	};
}

/** Zugangsdaten stehen am Link, nicht am Dock und nicht im ICCM-Klartext-Beispiel. */
export function readLinkCredentials(credentials: unknown): { username?: string; password?: string } {
	if (credentials == null) {
		return {};
	}
	if (typeof credentials === "string") {
		return splitUserPass(credentials);
	}
	if (!Array.isArray(credentials) || credentials.length === 0) {
		return {};
	}
	const first = credentials[0];
	if (typeof first === "string") {
		return splitUserPass(first);
	}
	if (!first || typeof first !== "object") {
		return {};
	}
	const record = first as Record<string, unknown>;
	const username = String(record.username ?? record.user ?? "").trim();
	const password = String(record.password ?? record.pass ?? "").trim();
	if (username || password) {
		return {
			username: username || undefined,
			password: password || undefined,
		};
	}
	if (typeof record.value === "string") {
		return splitUserPass(record.value);
	}
	return {};
}

function defaultPortForScheme(scheme: string): number | undefined {
	if (scheme === "http") {
		return 80;
	}
	if (scheme === "https") {
		return 443;
	}
	if (scheme === "ssh" || scheme === "scp") {
		return 22;
	}
	return undefined;
}

/** Sichtbare Ziel-URL aus Nach-Dock (Host/Pfad/Schema), z. B. https://google.com/irgendwo */
export function buildIccmTargetUrl(
	target: IccmLegacyConnection,
	options?: { includeUserinfo?: boolean; includePassword?: boolean }
): string | null {
	if (!target.host) {
		return null;
	}
	const scheme =
		target.scheme ||
		(target.type === "ssh" ? "ssh" : target.type === "scp" ? "scp" : target.port === 80 ? "http" : "https");
	const skipPort = defaultPortForScheme(scheme);
	let userinfo = "";
	if (options?.includeUserinfo && target.username) {
		const user = encodeURIComponent(target.username);
		userinfo =
			options.includePassword && target.password
				? `${user}:${encodeURIComponent(target.password)}@`
				: `${user}@`;
	}
	const port = target.port != null && target.port !== skipPort ? `:${target.port}` : "";
	let path = target.path?.trim() || "";
	if (path && !path.startsWith("/")) {
		path = `/${path}`;
	}
	return `${scheme}://${userinfo}${target.host}${port}${path}`;
}

function assetLabel(asset: ConnectableAsset): string {
	return asset.definition?.name?.trim() || asset.definition?.label?.trim() || asset.id;
}

export function resolveAssetConnectTarget(
	asset: ConnectableAsset | undefined,
	dockId?: string,
	dockpartId?: string
): IccmLegacyConnection | null {
	if (!asset) {
		return null;
	}
	const docks = dockId ? asset.docks.filter((dock) => String(dock.id) === String(dockId)) : asset.docks.slice();
	let host = "";
	let port: number | undefined;
	let path: string | undefined;
	let type: IccmLegacyConnection["type"] = "generic";
	let protocol = "";

	for (const dock of docks) {
		const parts = collectDockpartChain(dock, dockpartId);
		for (const part of parts) {
			const proto = protocolOf(part);
			const hostname = readSetting(part, "hostname") || readSetting(part, "dns");
			const ip = readSetting(part, "ip");
			const portValue = readSetting(part, "port");
			const pathValue = readSetting(part, "path");
			if (hostname) {
				host = hostname;
			} else if (ip && !host) {
				host = ip;
			}
			if (portValue) {
				const parsed = Number(portValue);
				if (Number.isFinite(parsed)) {
					port = parsed;
				}
			}
			if (pathValue) {
				path = pathValue;
			}
			if (proto) {
				const nextType = iccmTypeForProtocol(proto);
				if (nextType !== "generic") {
					type = nextType;
					protocol = proto;
				} else if (!protocol) {
					protocol = proto;
				}
			}
		}
		if (!host) {
			for (const hint of dock.hints ?? []) {
				if (hint.value?.trim()) {
					host = hint.value.trim();
					break;
				}
			}
		}
	}

	if (!host) {
		return null;
	}
	if (port == null) {
		port = defaultPort(type, protocol);
	}
	return {
		label: assetLabel(asset),
		type,
		host,
		port,
		path,
		scheme: schemeFor(type, protocol),
	};
}

export function connectionIccmDestinationSide(direction?: string | null): "from" | "to" {
	return resolveConnectionDirection(direction) === "IN" ? "from" : "to";
}

export function resolveConnectionSideTarget(
	connection: ConnectableConnection,
	assets: ConnectableAsset[],
	side: "from" | "to"
): IccmLegacyConnection | null {
	const link = connection.links[0];
	if (!link?.fromComponentRef || !link?.toComponentRef) {
		return null;
	}
	const dockRef = side === "from" ? link.fromDockRef : link.toDockRef;
	const componentRef = side === "from" ? link.fromComponentRef : link.toComponentRef;
	const dockpartRef =
		side === "from" ? link.linkparts[0]?.fromDockpartRef : link.linkparts[0]?.toDockpartRef;
	const parsed = parseDockEndpointRef(dockRef);
	const dockId = parseDockRef(dockRef);
	const dockpartId = parsed?.dockpartId || dockpartRef || "";
	const asset = assets.find((item) => item.id === componentRef);
	return resolveAssetConnectTarget(asset, dockId, dockpartId || undefined);
}

/** Ein ICCM-Ziel je Connection: Host/Pfad vom Ziel-Dock, User/Pass vom Link. */
export function resolveConnectionConnectTarget(
	connection: ConnectableConnection,
	assets: ConnectableAsset[]
): IccmLegacyConnection | null {
	const link = connection.links[0];
	if (!link) {
		return null;
	}
	const target = resolveConnectionSideTarget(
		connection,
		assets,
		connectionIccmDestinationSide(link.direction)
	);
	if (!target) {
		return null;
	}
	const credentials = readLinkCredentials(link.credentials);
	return {
		...target,
		username: credentials.username,
		password: credentials.password,
	};
}
