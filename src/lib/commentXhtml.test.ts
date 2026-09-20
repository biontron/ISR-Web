/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0
*/

import {
	blocksToXhtml,
	commentSourceToEditorHtml,
	looksLikeCommentHtml,
	parseCommentSource,
	sanitizeCommentXhtml,
} from "./commentXhtml";
import { parseCommentMarkdown } from "./commentMarkdown";

describe("commentXhtml", () => {
	it("erkennt XHTML und lässt Markdown-Autolinks in Ruhe", () => {
		expect(looksLikeCommentHtml("<p><strong>fett</strong></p>")).toBe(true);
		expect(looksLikeCommentHtml("<https://google.com/irgendwo>\niccm://connect?enc=abc")).toBe(false);
		expect(looksLikeCommentHtml("**fett** und [x](https://example.com)")).toBe(false);
	});

	it("serialisiert eine erlaubte Teilmenge als XHTML", () => {
		expect(
			sanitizeCommentXhtml('<div>Hallo <b>fett</b> und <i>kursiv</i> plus <u>unterstrichen</u></div>')
		).toBe("<p>Hallo <strong>fett</strong> und <em>kursiv</em> plus <u>unterstrichen</u></p>");
	});

	it("verwirft Script, Styles und unsichere hrefs", () => {
		expect(
			sanitizeCommentXhtml('<p onclick="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">x</a><a href="https://ok.example.com">ok</a></p>')
		).toBe('<p>x<a href="https://ok.example.com">ok</a></p>');
	});

	it("parst Unterstreichung und ICCM-Links aus XHTML", () => {
		const [block] = parseCommentSource(
			'<p><u>wichtig</u> <a href="https://google.com/x">Google</a> <a href="iccm://connect?enc=abc">ICCM</a></p>'
		);
		expect(block).toEqual({
			type: "paragraph",
			children: [
				{ type: "underline", children: [{ type: "text", value: "wichtig" }] },
				{ type: "text", value: " " },
				{
					type: "link",
					kind: "web",
					href: "https://google.com/x",
					children: [{ type: "text", value: "Google" }],
				},
				{ type: "text", value: " " },
				{
					type: "link",
					kind: "iccm",
					href: "iccm://connect?enc=abc",
					children: [{ type: "text", value: "ICCM" }],
				},
			],
		});
	});

	it("wandelt Markdown für den Editor nach XHTML um", () => {
		expect(commentSourceToEditorHtml("**fett**")).toBe("<p><strong>fett</strong></p>");
		expect(blocksToXhtml(parseCommentMarkdown("[Google](https://google.com/x)"))).toBe(
			'<p><a href="https://google.com/x">Google</a></p>'
		);
	});
});
