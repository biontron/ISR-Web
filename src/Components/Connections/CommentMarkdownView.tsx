import React from "react";
import {
	CommentBlock,
	CommentInline,
	commentInlineText,
} from "../../lib/commentMarkdown";
import { parseCommentSource } from "../../lib/commentXhtml";
import IccmOpenLink, { CommentHrefTooltip } from "./IccmOpenLink";

function CommentInlineView({ nodes }: { nodes: CommentInline[] }) {
	return (
		<>
			{nodes.map((node, index) => {
				const key = `${node.type}:${index}`;
				switch (node.type) {
					case "text":
						return <React.Fragment key={key}>{node.value}</React.Fragment>;
					case "break":
						return <br key={key} />;
					case "strong":
						return (
							<strong key={key}>
								<CommentInlineView nodes={node.children} />
							</strong>
						);
					case "em":
						return (
							<em key={key}>
								<CommentInlineView nodes={node.children} />
							</em>
						);
					case "underline":
						return (
							<u key={key}>
								<CommentInlineView nodes={node.children} />
							</u>
						);
					case "del":
						return (
							<del key={key}>
								<CommentInlineView nodes={node.children} />
							</del>
						);
					case "code":
						return <code key={key}>{node.value}</code>;
					case "link":
						if (node.kind === "iccm") {
							const label = commentInlineText(node.children).trim();
							const named = label && label !== node.href && label.toUpperCase() !== "ICCM";
							return (
								<IccmOpenLink
									key={key}
									href={node.href}
									variant="inline"
									label={named ? label : undefined}
								/>
							);
						}
						return (
							<CommentHrefTooltip key={key} href={node.href}>
								<a
									className="schema-editor-comment-link schema-editor-comment-link--web"
									href={node.href}
									target="_blank"
									rel="noopener noreferrer"
								>
									<CommentInlineView nodes={node.children} />
								</a>
							</CommentHrefTooltip>
						);
					default:
						return null;
				}
			})}
		</>
	);
}

function CommentBlockView({ block }: { block: CommentBlock }) {
	switch (block.type) {
		case "heading": {
			const Tag = (`h${block.level}` as "h1" | "h2" | "h3");
			return (
				<Tag>
					<CommentInlineView nodes={block.children} />
				</Tag>
			);
		}
		case "paragraph":
			return (
				<p>
					<CommentInlineView nodes={block.children} />
				</p>
			);
		case "blockquote":
			return (
				<blockquote>
					<CommentInlineView nodes={block.children} />
				</blockquote>
			);
		case "code":
			return (
				<pre>
					<code>{block.value}</code>
				</pre>
			);
		case "list": {
			const Tag = block.ordered ? "ol" : "ul";
			return (
				<Tag>
					{block.items.map((item, index) => (
						<li key={index}>
							<CommentInlineView nodes={item} />
						</li>
					))}
				</Tag>
			);
		}
		default:
			return null;
	}
}

export function CommentMarkdownView({ value }: { value: string }) {
	if (!value) {
		return <div className="schema-editor-field-value Input">{"\u00a0"}</div>;
	}
	const blocks = parseCommentSource(value);
	return (
		<div className="schema-editor-field-value schema-editor-comment-view schema-editor-comment-md Input">
			{blocks.length === 0 ? "\u00a0" : blocks.map((block, index) => <CommentBlockView key={index} block={block} />)}
		</div>
	);
}

export default CommentMarkdownView;
