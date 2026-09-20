/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0
*/

export type CommentLinkKind = "web" | "iccm";

export type CommentInline =
	| { type: "text"; value: string }
	| { type: "strong"; children: CommentInline[] }
	| { type: "em"; children: CommentInline[] }
	| { type: "underline"; children: CommentInline[] }
	| { type: "del"; children: CommentInline[] }
	| { type: "code"; value: string }
	| { type: "break" }
	| { type: "link"; href: string; kind: CommentLinkKind; children: CommentInline[] };

export type CommentBlock =
	| { type: "heading"; level: 1 | 2 | 3; children: CommentInline[] }
	| { type: "paragraph"; children: CommentInline[] }
	| { type: "list"; ordered: boolean; items: CommentInline[][] }
	| { type: "code"; value: string }
	| { type: "blockquote"; children: CommentInline[] };

const ICCM_HREF = /^iccm:\/\/connect\?/i;
const WEB_HREF = /^https?:\/\//i;
const AUTOLINK = /^(https:\/\/|http:\/\/|iccm:\/\/connect\?)[^\s<>\[\]()`]+/i;

export function classifyCommentHref(raw: string): { href: string; kind: CommentLinkKind } | undefined {
	const href = raw.trim();
	if (!href || /[\s<>]/.test(href)) {
		return undefined;
	}
	if (ICCM_HREF.test(href)) {
		return { href, kind: "iccm" };
	}
	if (WEB_HREF.test(href)) {
		try {
			const parsed = new URL(href);
			if (parsed.protocol === "http:" || parsed.protocol === "https:") {
				return { href, kind: "web" };
			}
		} catch {
			return undefined;
		}
	}
	return undefined;
}

export function commentInlineText(nodes: CommentInline[]): string {
	return nodes
		.map((node) => {
			if (node.type === "text" || node.type === "code") {
				return node.value;
			}
			if (node.type === "break") {
				return "\n";
			}
			if (node.type === "link") {
				return commentInlineText(node.children) || node.href;
			}
			if ("children" in node) {
				return commentInlineText(node.children);
			}
			return "";
		})
		.join("");
}

export function parseCommentMarkdown(source: string): CommentBlock[] {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	const blocks: CommentBlock[] = [];
	let index = 0;
	while (index < lines.length) {
		const line = lines[index];
		if (/^\s*$/.test(line)) {
			index += 1;
			continue;
		}
		if (line.startsWith("```")) {
			const body: string[] = [];
			index += 1;
			while (index < lines.length && !lines[index].startsWith("```")) {
				body.push(lines[index]);
				index += 1;
			}
			if (index < lines.length) {
				index += 1;
			}
			blocks.push({ type: "code", value: body.join("\n") });
			continue;
		}
		const heading = /^(#{1,3})\s+(.+)$/.exec(line);
		if (heading) {
			const level = heading[1].length as 1 | 2 | 3;
			blocks.push({ type: "heading", level, children: parseInlines(heading[2]) });
			index += 1;
			continue;
		}
		const quote = /^>\s?(.*)$/.exec(line);
		if (quote) {
			const quoted: string[] = [quote[1]];
			index += 1;
			while (index < lines.length) {
				const next = /^>\s?(.*)$/.exec(lines[index]);
				if (!next) {
					break;
				}
				quoted.push(next[1]);
				index += 1;
			}
			blocks.push({ type: "blockquote", children: parseInlines(quoted.join("\n")) });
			continue;
		}
		const listItem = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(line);
		if (listItem) {
			const ordered = /^\d+\.$/.test(listItem[2]);
			const items: CommentInline[][] = [];
			while (index < lines.length) {
				const next = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(lines[index]);
				if (!next) {
					break;
				}
				if (/^\d+\.$/.test(next[2]) !== ordered) {
					break;
				}
				items.push(parseInlines(next[3]));
				index += 1;
			}
			blocks.push({ type: "list", ordered, items });
			continue;
		}
		const paragraph: string[] = [line];
		index += 1;
		while (index < lines.length) {
			const next = lines[index];
			if (/^\s*$/.test(next) || next.startsWith("```") || /^#{1,3}\s+/.test(next)) {
				break;
			}
			if (/^>\s?/.test(next) || /^(\s*)([-*+]|\d+\.)\s+/.test(next)) {
				break;
			}
			paragraph.push(next);
			index += 1;
		}
		blocks.push({ type: "paragraph", children: parseInlines(paragraph.join("\n")) });
	}
	return blocks;
}

function parseInlines(text: string): CommentInline[] {
	const nodes: CommentInline[] = [];
	let index = 0;

	const pushText = (value: string) => {
		if (!value) {
			return;
		}
		const last = nodes[nodes.length - 1];
		if (last?.type === "text") {
			last.value += value;
			return;
		}
		nodes.push({ type: "text", value });
	};

	while (index < text.length) {
		const char = text[index];
		if (char === "\n") {
			nodes.push({ type: "break" });
			index += 1;
			continue;
		}
		if (char === "\\" && index + 1 < text.length) {
			pushText(text[index + 1]);
			index += 2;
			continue;
		}
		if (char === "`") {
			const end = text.indexOf("`", index + 1);
			if (end > index) {
				nodes.push({ type: "code", value: text.slice(index + 1, end) });
				index = end + 1;
				continue;
			}
		}
		if (text.startsWith("~~", index)) {
			const end = text.indexOf("~~", index + 2);
			if (end > index + 2) {
				nodes.push({ type: "del", children: parseInlines(text.slice(index + 2, end)) });
				index = end + 2;
				continue;
			}
		}
		if (text.startsWith("**", index) || text.startsWith("__", index)) {
			const delim = text.slice(index, index + 2);
			const end = text.indexOf(delim, index + 2);
			if (end > index + 2) {
				nodes.push({ type: "strong", children: parseInlines(text.slice(index + 2, end)) });
				index = end + 2;
				continue;
			}
		}
		if ((char === "*" || char === "_") && text[index + 1] && text[index + 1] !== " " && text[index + 1] !== char) {
			if (char === "_" && isWordChar(text[index - 1])) {
				pushText(char);
				index += 1;
				continue;
			}
			const end = findUnescaped(text, char, index + 1);
			if (end > index + 1 && text[end - 1] !== " " && !(char === "_" && isWordChar(text[end + 1]))) {
				nodes.push({ type: "em", children: parseInlines(text.slice(index + 1, end)) });
				index = end + 1;
				continue;
			}
		}
		if (char === "[") {
			const labelEnd = findBalanced(text, index, "[", "]");
			if (labelEnd > index && text[labelEnd + 1] === "(") {
				const hrefEnd = findBalanced(text, labelEnd + 1, "(", ")");
				if (hrefEnd > labelEnd + 1) {
					const classified = classifyCommentHref(text.slice(labelEnd + 2, hrefEnd));
					if (classified) {
						nodes.push({
							type: "link",
							href: classified.href,
							kind: classified.kind,
							children: parseInlines(text.slice(index + 1, labelEnd)),
						});
						index = hrefEnd + 1;
						continue;
					}
				}
			}
		}
		if (char === "<") {
			const end = text.indexOf(">", index + 1);
			if (end > index + 1) {
				const classified = classifyCommentHref(text.slice(index + 1, end));
				if (classified) {
					nodes.push({
						type: "link",
						href: classified.href,
						kind: classified.kind,
						children: classified.kind === "iccm" ? [] : [{ type: "text", value: classified.href }],
					});
					index = end + 1;
					continue;
				}
			}
		}
		const autolink = matchAutolink(text, index);
		if (autolink) {
			nodes.push({
				type: "link",
				href: autolink.href,
				kind: autolink.kind,
				children: autolink.kind === "iccm" ? [] : [{ type: "text", value: autolink.href }],
			});
			index += autolink.length;
			continue;
		}
		pushText(char);
		index += 1;
	}
	return nodes;
}

function findUnescaped(text: string, needle: string, from: number): number {
	for (let index = from; index < text.length; index += 1) {
		if (text[index] === "\\") {
			index += 1;
			continue;
		}
		if (text[index] === needle) {
			return index;
		}
	}
	return -1;
}

function findBalanced(text: string, start: number, open: string, close: string): number {
	let depth = 0;
	for (let index = start; index < text.length; index += 1) {
		if (text[index] === "\\") {
			index += 1;
			continue;
		}
		if (text[index] === open) {
			depth += 1;
			continue;
		}
		if (text[index] === close) {
			depth -= 1;
			if (depth === 0) {
				return index;
			}
		}
	}
	return -1;
}

function matchAutolink(text: string, index: number): { href: string; kind: CommentLinkKind; length: number } | undefined {
	const match = AUTOLINK.exec(text.slice(index));
	if (!match) {
		return undefined;
	}
	const raw = trimTrailingPunctuation(match[0]);
	const classified = classifyCommentHref(raw);
	if (!classified) {
		return undefined;
	}
	return { href: classified.href, kind: classified.kind, length: raw.length };
}

function trimTrailingPunctuation(value: string): string {
	return value.replace(/[.,;:!?]+$/g, "");
}

function isWordChar(value: string | undefined): boolean {
	return !!value && /[A-Za-z0-9]/.test(value);
}
