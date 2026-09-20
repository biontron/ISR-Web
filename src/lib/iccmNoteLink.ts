/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0
*/

import { escapeXml, type IccmLegacyConnection } from "./iccmConnectLink";
import { classifyCommentHref } from "./commentMarkdown";
import { buildIccmTargetUrl, resolveAssetConnectTarget, type ConnectableAsset } from "./iccmConnectTarget";

const ICCM_HREF_PATTERN = /iccm:\/\/connect\?[^\s]+/g;
const COMMENT_FIELD_NAMES = new Set(["note", "notes", "comment"]);
const PRESET_PROTOCOLS = new Set(["HTTPS", "HTTP", "SSH", "SFTP", "SCP", "BROWSER"]);

export function isSchemaCommentField(itemName: string | undefined): boolean {
	return COMMENT_FIELD_NAMES.has((itemName ?? "").trim());
}

export function formatIccmNoteSnippet(target: IccmLegacyConnection, href: string): string {
	const url = buildIccmTargetUrl(target) || target.host;
	const title = target.label?.trim() || url;
	const web = classifyCommentHref(url);
	const iccm = `<a href="${escapeXml(href)}">ICCM</a>`;
	if (web) {
		return `<p><a href="${escapeXml(web.href)}">${escapeXml(title)}</a><br />\n${iccm}</p>`;
	}
	return `<p>${escapeXml(title)}<br />\n${iccm}</p>`;
}

export function insertTextAtCursor(
	source: string,
	insert: string,
	start: number,
	end: number
): { next: string; cursor: number } {
	const before = source.slice(0, start);
	const after = source.slice(end);
	const leftPad = before && !/\n$/.test(before) ? "\n" : "";
	const rightPad = after && !/^\n/.test(after) ? "\n" : "";
	const next = `${before}${leftPad}${insert}${rightPad}${after}`;
	return { next, cursor: before.length + leftPad.length + insert.length };
}

export type IccmNoteSegment =
	| { kind: "text"; value: string }
	| { kind: "iccm"; href: string };

export function splitIccmNoteSegments(text: string): IccmNoteSegment[] {
	const segments: IccmNoteSegment[] = [];
	const pattern = new RegExp(ICCM_HREF_PATTERN.source, "g");
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(text))) {
		if (match.index > lastIndex) {
			segments.push({ kind: "text", value: text.slice(lastIndex, match.index) });
		}
		segments.push({ kind: "iccm", href: match[0] });
		lastIndex = match.index + match[0].length;
	}
	if (lastIndex < text.length) {
		segments.push({ kind: "text", value: text.slice(lastIndex) });
	}
	return segments;
}

export type IccmDockPreset = {
	key: string;
	label: string;
	target: IccmLegacyConnection;
};

export function collectAssetIccmPresets(asset: ConnectableAsset | undefined): IccmDockPreset[] {
	if (!asset) {
		return [];
	}
	const presets: IccmDockPreset[] = [];
	const seen = new Set<string>();
	for (const dock of asset.docks) {
		for (const part of dock.dockparts) {
			const proto = (part.protocol || part.type || "").trim().toUpperCase();
			if (!PRESET_PROTOCOLS.has(proto)) {
				continue;
			}
			const target = resolveAssetConnectTarget(asset, dock.id, String(part.id));
			if (!target) {
				continue;
			}
			const key = `${dock.id}#${part.id}`;
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);
			const url = buildIccmTargetUrl(target) || target.host;
			presets.push({
				key,
				label: `${proto} · ${url}`,
				target: {
					...target,
					label: target.label || proto,
				},
			});
		}
	}
	return presets;
}

export function defaultPortForIccmType(type: IccmLegacyConnection["type"]): number {
	if (type === "ssh" || type === "scp") {
		return 22;
	}
	return 443;
}

export function schemeForIccmType(type: IccmLegacyConnection["type"]): string {
	if (type === "ssh") {
		return "ssh";
	}
	if (type === "scp") {
		return "scp";
	}
	return "https";
}
