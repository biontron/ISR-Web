/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0
*/

import {
	classifyCommentHref,
	commentInlineText,
	parseCommentMarkdown,
} from "./commentMarkdown";

describe("commentMarkdown", () => {
	it("parst Überschriften, Fett, Kursiv, Code und Listen", () => {
		const [heading, paragraph, list] = parseCommentMarkdown(
			"# Titel\n\nDas ist **fett** und *kursiv* plus `code`.\n\n- eins\n- zwei"
		);
		expect(heading).toMatchObject({ type: "heading", level: 1 });
		expect(commentInlineText(heading.type === "heading" ? heading.children : [])).toBe("Titel");
		expect(paragraph).toMatchObject({ type: "paragraph" });
		expect(paragraph.type === "paragraph" ? paragraph.children : []).toEqual([
			{ type: "text", value: "Das ist " },
			{ type: "strong", children: [{ type: "text", value: "fett" }] },
			{ type: "text", value: " und " },
			{ type: "em", children: [{ type: "text", value: "kursiv" }] },
			{ type: "text", value: " plus " },
			{ type: "code", value: "code" },
			{ type: "text", value: "." },
		]);
		expect(list).toEqual({
			type: "list",
			ordered: false,
			items: [[{ type: "text", value: "eins" }], [{ type: "text", value: "zwei" }]],
		});
	});

	it("unterscheidet Markdown-Web-Links von ICCM-Links", () => {
		const [block] = parseCommentMarkdown(
			"[Google](https://google.com/irgendwo) und [Verbinden](iccm://connect?enc=abc)"
		);
		expect(block.type).toBe("paragraph");
		const children = block.type === "paragraph" ? block.children : [];
		expect(children[0]).toEqual({
			type: "link",
			kind: "web",
			href: "https://google.com/irgendwo",
			children: [{ type: "text", value: "Google" }],
		});
		expect(children[2]).toEqual({
			type: "link",
			kind: "iccm",
			href: "iccm://connect?enc=abc",
			children: [{ type: "text", value: "Verbinden" }],
		});
	});

	it("autoverlinkt nackte http(s)- und iccm-URLs", () => {
		const [block] = parseCommentMarkdown("siehe https://example.com/pfad und iccm://connect?enc=abc%2B bitte.");
		const children = block.type === "paragraph" ? block.children : [];
		expect(children).toEqual([
			{ type: "text", value: "siehe " },
			{
				type: "link",
				kind: "web",
				href: "https://example.com/pfad",
				children: [{ type: "text", value: "https://example.com/pfad" }],
			},
			{ type: "text", value: " und " },
			{ type: "link", kind: "iccm", href: "iccm://connect?enc=abc%2B", children: [] },
			{ type: "text", value: " bitte." },
		]);
	});

	it("verwirft unsichere hrefs", () => {
		expect(classifyCommentHref("javascript:alert(1)")).toBeUndefined();
		expect(classifyCommentHref("data:text/html,x")).toBeUndefined();
		const [block] = parseCommentMarkdown("[x](javascript:alert(1))");
		expect(block).toEqual({
			type: "paragraph",
			children: [{ type: "text", value: "[x](javascript:alert(1))" }],
		});
	});
});
