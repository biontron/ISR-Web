/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0
*/

import { escapeXml } from "./iccmConnectLink";
import {
	classifyCommentHref,
	parseCommentMarkdown,
	type CommentBlock,
	type CommentInline,
} from "./commentMarkdown";

const SKIP_TAGS = new Set(["script", "style", "iframe", "object", "embed", "link", "meta", "noscript"]);
const BLOCK_TAGS = new Set(["p", "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "pre", "div"]);
const ALLOWED_TAGS = new Set([
	"p",
	"br",
	"strong",
	"b",
	"em",
	"i",
	"u",
	"del",
	"s",
	"strike",
	"a",
	"ul",
	"ol",
	"li",
	"h1",
	"h2",
	"h3",
	"blockquote",
	"pre",
	"code",
	"div",
	"span",
]);

export function looksLikeCommentHtml(source: string): boolean {
	const trimmed = source.trim();
	if (!trimmed.startsWith("<")) {
		if (!/<(p|br|div|span|strong|b|em|i|u|a|ul|ol|li|h[1-3]|blockquote|pre|code|del)\b/i.test(trimmed)) {
			return false;
		}
	}
	if (/^<https?:\/\//i.test(trimmed) || /^<iccm:/i.test(trimmed)) {
		return false;
	}
	return /<(p|br|div|span|strong|b|em|i|u|a|ul|ol|li|h[1-3]|blockquote|pre|code|del)\b/i.test(trimmed);
}

export function parseCommentSource(source: string): CommentBlock[] {
	if (looksLikeCommentHtml(source)) {
		return parseCommentHtml(source);
	}
	return parseCommentMarkdown(source);
}

export function commentSourceToEditorHtml(source: string): string {
	if (!source.trim()) {
		return "";
	}
	if (looksLikeCommentHtml(source)) {
		return sanitizeCommentXhtml(source);
	}
	return blocksToXhtml(parseCommentMarkdown(source));
}

export function sanitizeCommentXhtml(html: string): string {
	return serializeCommentNodes(Array.from(parseHtmlFragment(html).childNodes)).trim();
}

export function serializeCommentElement(element: HTMLElement): string {
	return serializeCommentNodes(Array.from(element.childNodes)).trim();
}

export function blocksToXhtml(blocks: CommentBlock[]): string {
	return blocks.map(blockToXhtml).join("");
}

function parseHtmlFragment(html: string): HTMLElement {
	const doc = new DOMParser().parseFromString(`<div id="isr-comment-root">${html}</div>`, "text/html");
	return (doc.getElementById("isr-comment-root") as HTMLElement | null) ?? doc.body;
}

function parseCommentHtml(html: string): CommentBlock[] {
	return blocksFromNodes(Array.from(parseHtmlFragment(html).childNodes));
}

function blocksFromNodes(nodes: Node[]): CommentBlock[] {
	const blocks: CommentBlock[] = [];
	let pending: CommentInline[] = [];
	const flush = () => {
		if (pending.length === 0) {
			return;
		}
		blocks.push({ type: "paragraph", children: pending });
		pending = [];
	};
	for (const node of nodes) {
		if (node.nodeType === Node.TEXT_NODE) {
			const value = node.textContent ?? "";
			if (!value.trim()) {
				continue;
			}
			pending.push(...inlinesFromNodes([node]));
			continue;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) {
			continue;
		}
		const element = node as HTMLElement;
		const tag = element.tagName.toLowerCase();
		if (SKIP_TAGS.has(tag)) {
			continue;
		}
		if (tag === "br") {
			pending.push({ type: "break" });
			continue;
		}
		if (tag === "h1" || tag === "h2" || tag === "h3") {
			flush();
			blocks.push({
				type: "heading",
				level: Number(tag[1]) as 1 | 2 | 3,
				children: inlinesFromNodes(Array.from(element.childNodes)),
			});
			continue;
		}
		if (tag === "blockquote") {
			flush();
			blocks.push({ type: "blockquote", children: inlinesFromNodes(Array.from(element.childNodes)) });
			continue;
		}
		if (tag === "pre") {
			flush();
			blocks.push({ type: "code", value: element.textContent ?? "" });
			continue;
		}
		if (tag === "ul" || tag === "ol") {
			flush();
			blocks.push({
				type: "list",
				ordered: tag === "ol",
				items: Array.from(element.children)
					.filter((child) => child.tagName.toLowerCase() === "li")
					.map((child) => inlinesFromNodes(Array.from(child.childNodes))),
			});
			continue;
		}
		if (tag === "p" || tag === "div") {
			flush();
			const children = inlinesFromNodes(Array.from(element.childNodes));
			if (children.length > 0) {
				blocks.push({ type: "paragraph", children });
			}
			continue;
		}
		pending.push(...inlinesFromNodes([node]));
	}
	flush();
	return blocks;
}

function inlinesFromNodes(nodes: Node[]): CommentInline[] {
	const out: CommentInline[] = [];
	const pushText = (value: string) => {
		if (!value) {
			return;
		}
		const last = out[out.length - 1];
		if (last?.type === "text") {
			last.value += value;
			return;
		}
		out.push({ type: "text", value });
	};
	for (const node of nodes) {
		if (node.nodeType === Node.TEXT_NODE) {
			pushText(node.textContent ?? "");
			continue;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) {
			continue;
		}
		const element = node as HTMLElement;
		const tag = element.tagName.toLowerCase();
		if (SKIP_TAGS.has(tag)) {
			continue;
		}
		const children = () => inlinesFromNodes(Array.from(element.childNodes));
		if (tag === "br") {
			out.push({ type: "break" });
			continue;
		}
		if (tag === "strong" || tag === "b") {
			out.push({ type: "strong", children: children() });
			continue;
		}
		if (tag === "em" || tag === "i") {
			out.push({ type: "em", children: children() });
			continue;
		}
		if (tag === "u") {
			out.push({ type: "underline", children: children() });
			continue;
		}
		if (tag === "del" || tag === "s" || tag === "strike") {
			out.push({ type: "del", children: children() });
			continue;
		}
		if (tag === "code") {
			out.push({ type: "code", value: element.textContent ?? "" });
			continue;
		}
		if (tag === "a") {
			const classified = classifyCommentHref(element.getAttribute("href") ?? "");
			if (classified) {
				out.push({ type: "link", href: classified.href, kind: classified.kind, children: children() });
				continue;
			}
		}
		for (const child of children()) {
			if (child.type === "text") {
				pushText(child.value);
			} else {
				out.push(child);
			}
		}
	}
	return out;
}

function serializeCommentNodes(nodes: Node[]): string {
	const out: string[] = [];
	let inline: string[] = [];
	const flushInline = () => {
		const body = inline.join("");
		if (body.replace(/<br \/>/g, "").trim()) {
			out.push(`<p>${body}</p>`);
		}
		inline = [];
	};
	for (const node of nodes) {
		if (isBlockElement(node)) {
			flushInline();
			const serialized = serializeBlock(node as HTMLElement);
			if (serialized) {
				out.push(serialized);
			}
			continue;
		}
		inline.push(serializeInline(node));
	}
	flushInline();
	return out.join("");
}

function isBlockElement(node: Node): boolean {
	return node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((node as HTMLElement).tagName.toLowerCase());
}

function serializeBlock(element: HTMLElement): string {
	const tag = normalizeTag(element.tagName.toLowerCase());
	if (tag === "div") {
		return serializeCommentNodes(Array.from(element.childNodes));
	}
	if (tag === "pre") {
		return `<pre><code>${escapeXml(element.textContent ?? "")}</code></pre>`;
	}
	if (tag === "ul" || tag === "ol") {
		const items = Array.from(element.children)
			.filter((child) => child.tagName.toLowerCase() === "li")
			.map((child) => `<li>${serializeInlines(Array.from(child.childNodes))}</li>`)
			.join("");
		return items ? `<${tag}>${items}</${tag}>` : "";
	}
	if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "p" || tag === "blockquote") {
		const body = serializeInlines(Array.from(element.childNodes));
		if (!body.trim() && tag === "p") {
			return "";
		}
		return `<${tag}>${body}</${tag}>`;
	}
	if (tag === "li") {
		return `<p>${serializeInlines(Array.from(element.childNodes))}</p>`;
	}
	return serializeInlines(Array.from(element.childNodes));
}

function serializeInlines(nodes: Node[]): string {
	return nodes.map(serializeInline).join("");
}

function serializeInline(node: Node): string {
	if (node.nodeType === Node.TEXT_NODE) {
		return escapeXml(node.textContent ?? "");
	}
	if (node.nodeType !== Node.ELEMENT_NODE) {
		return "";
	}
	const element = node as HTMLElement;
	const rawTag = element.tagName.toLowerCase();
	if (SKIP_TAGS.has(rawTag) || !ALLOWED_TAGS.has(rawTag)) {
		if (SKIP_TAGS.has(rawTag)) {
			return "";
		}
		return serializeInlines(Array.from(element.childNodes));
	}
	const tag = normalizeTag(rawTag);
	if (tag === "br") {
		return "<br />";
	}
	if (tag === "a") {
		const classified = classifyCommentHref(element.getAttribute("href") ?? "");
		if (!classified) {
			return serializeInlines(Array.from(element.childNodes));
		}
		return `<a href="${escapeXml(classified.href)}">${serializeInlines(Array.from(element.childNodes))}</a>`;
	}
	if (tag === "code") {
		return `<code>${escapeXml(element.textContent ?? "")}</code>`;
	}
	if (tag === "strong" || tag === "em" || tag === "u" || tag === "del") {
		return `<${tag}>${serializeInlines(Array.from(element.childNodes))}</${tag}>`;
	}
	return serializeInlines(Array.from(element.childNodes));
}

function normalizeTag(tag: string): string {
	if (tag === "b") {
		return "strong";
	}
	if (tag === "i") {
		return "em";
	}
	if (tag === "s" || tag === "strike") {
		return "del";
	}
	return tag;
}

function blockToXhtml(block: CommentBlock): string {
	switch (block.type) {
		case "heading":
			return `<h${block.level}>${inlinesToXhtml(block.children)}</h${block.level}>`;
		case "paragraph":
			return `<p>${inlinesToXhtml(block.children)}</p>`;
		case "blockquote":
			return `<blockquote>${inlinesToXhtml(block.children)}</blockquote>`;
		case "code":
			return `<pre><code>${escapeXml(block.value)}</code></pre>`;
		case "list": {
			const tag = block.ordered ? "ol" : "ul";
			const items = block.items.map((item) => `<li>${inlinesToXhtml(item)}</li>`).join("");
			return `<${tag}>${items}</${tag}>`;
		}
		default:
			return "";
	}
}

function inlinesToXhtml(nodes: CommentInline[]): string {
	return nodes
		.map((node) => {
			switch (node.type) {
				case "text":
					return escapeXml(node.value);
				case "break":
					return "<br />";
				case "strong":
					return `<strong>${inlinesToXhtml(node.children)}</strong>`;
				case "em":
					return `<em>${inlinesToXhtml(node.children)}</em>`;
				case "underline":
					return `<u>${inlinesToXhtml(node.children)}</u>`;
				case "del":
					return `<del>${inlinesToXhtml(node.children)}</del>`;
				case "code":
					return `<code>${escapeXml(node.value)}</code>`;
				case "link": {
					const label = inlinesToXhtml(node.children);
					return `<a href="${escapeXml(node.href)}">${label || escapeXml(node.href)}</a>`;
				}
				default:
					return "";
			}
		})
		.join("");
}
