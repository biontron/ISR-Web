import { render } from "@testing-library/react";
import CommentMarkdownView from "./CommentMarkdownView";

jest.mock("./IccmOpenLink", () => ({
	__esModule: true,
	CommentHrefTooltip: ({ href, children }: { href: string; children: React.ReactNode }) => (
		<span data-web-href={href}>{children}</span>
	),
	default: ({ href, label }: { href?: string; label?: string }) => (
		<button type="button" className="schema-editor-comment-link schema-editor-comment-link--iccm" data-href={href}>
			{label || "Verbinden"}
		</button>
	),
}));

describe("CommentMarkdownView", () => {
	it("unterscheidet Web-Hrefs optisch von ICCM-Links", () => {
		const { container } = render(
			<CommentMarkdownView value={"[Google](https://google.com/irgendwo)\n\niccm://connect?enc=abc"} />
		);
		const web = container.querySelector("a.schema-editor-comment-link--web");
		const iccm = container.querySelector("button.schema-editor-comment-link--iccm");
		expect(web).toHaveAttribute("href", "https://google.com/irgendwo");
		expect(web).toHaveAttribute("target", "_blank");
		expect(web).toHaveTextContent("Google");
		expect(container.querySelector("[data-web-href='https://google.com/irgendwo']")).toBeTruthy();
		expect(iccm).toHaveAttribute("data-href", "iccm://connect?enc=abc");
		expect(iccm).toHaveTextContent("Verbinden");
		expect(container.querySelector("strong")).toBeNull();
	});

	it("rendert Markdown-Formatierung", () => {
		const { container } = render(<CommentMarkdownView value={"**wichtig** und `code`"} />);
		expect(container.querySelector("strong")).toHaveTextContent("wichtig");
		expect(container.querySelector("code")).toHaveTextContent("code");
	});

	it("rendert XHTML mit Unterstreichung und getrennten Linkarten", () => {
		const { container } = render(
			<CommentMarkdownView value={'<p><u>wichtig</u> <a href="https://google.com/x">Google</a> <a href="iccm://connect?enc=abc">ICCM</a></p>'} />
		);
		expect(container.querySelector("u")).toHaveTextContent("wichtig");
		expect(container.querySelector("a.schema-editor-comment-link--web")).toHaveAttribute(
			"href",
			"https://google.com/x"
		);
		expect(container.querySelector("button.schema-editor-comment-link--iccm")).toHaveAttribute(
			"data-href",
			"iccm://connect?enc=abc"
		);
		expect(container.querySelector("button.schema-editor-comment-link--iccm")).toHaveTextContent("Verbinden");
	});
});
