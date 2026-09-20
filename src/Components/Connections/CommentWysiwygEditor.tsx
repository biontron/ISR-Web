import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button, Input, Modal, Space, Tooltip } from "antd";
import {
	BoldOutlined,
	ItalicOutlined,
	LinkOutlined,
	OrderedListOutlined,
	StrikethroughOutlined,
	UnderlineOutlined,
	UnorderedListOutlined,
} from "@ant-design/icons";
import { useLangtext } from "../../lib/common";
import { classifyCommentHref } from "../../lib/commentMarkdown";
import { commentSourceToEditorHtml, sanitizeCommentXhtml, serializeCommentElement } from "../../lib/commentXhtml";
import { openIccmHref } from "../../lib/iccmLaunch";

export type CommentWysiwygEditorHandle = {
	command: (cmd: string, value?: string) => void;
	insertHtml: (html: string) => void;
	openLinkDialog: () => void;
	focus: () => void;
};

type CommentWysiwygEditorProps = {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	onIccmClick?: () => void;
};

type EditorMarks = {
	bold: boolean;
	italic: boolean;
	underline: boolean;
	strike: boolean;
};

const EMPTY_MARKS: EditorMarks = { bold: false, italic: false, underline: false, strike: false };

function queryMarks(): EditorMarks {
	try {
		return {
			bold: document.queryCommandState("bold"),
			italic: document.queryCommandState("italic"),
			underline: document.queryCommandState("underline"),
			strike: document.queryCommandState("strikeThrough"),
		};
	} catch {
		return EMPTY_MARKS;
	}
}

const CommentWysiwygEditor = forwardRef<CommentWysiwygEditorHandle, CommentWysiwygEditorProps>(
	({ value, onChange, placeholder, onIccmClick }, ref) => {
		const langtext = useLangtext();
		const editorRef = useRef<HTMLDivElement>(null);
		const rangeRef = useRef<Range | null>(null);
		const [marks, setMarks] = useState<EditorMarks>(EMPTY_MARKS);
		const [linkOpen, setLinkOpen] = useState(false);
		const [linkUrl, setLinkUrl] = useState("");
		const [linkText, setLinkText] = useState("");
		const [linkNeedsText, setLinkNeedsText] = useState(false);
		const [hoverHref, setHoverHref] = useState<string>();

		const emit = () => {
			const node = editorRef.current;
			if (!node) {
				return;
			}
			onChange(serializeCommentElement(node));
			setMarks(queryMarks());
		};

		const restoreRange = () => {
			const node = editorRef.current;
			const range = rangeRef.current;
			if (!node) {
				return;
			}
			node.focus();
			if (!range) {
				return;
			}
			const selection = window.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(range);
		};

		const saveRange = () => {
			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0) {
				rangeRef.current = selection.getRangeAt(0).cloneRange();
			}
		};

		const command = (cmd: string, argument?: string) => {
			restoreRange();
			document.execCommand("styleWithCSS", false, "false");
			document.execCommand(cmd, false, argument);
			emit();
		};

		const insertHtml = (html: string) => {
			const node = editorRef.current;
			if (!node) {
				return;
			}
			if (document.activeElement !== node) {
				restoreRange();
			} else {
				node.focus();
			}
			const safe = sanitizeCommentXhtml(html);
			if (!safe) {
				return;
			}
			const inserted = document.execCommand("insertHTML", false, safe);
			if (!inserted) {
				node.insertAdjacentHTML("beforeend", safe);
			}
			emit();
		};

		const openLinkDialog = () => {
			saveRange();
			const selection = window.getSelection();
			const selected = selection?.toString() ?? "";
			setLinkNeedsText(!selected.trim());
			setLinkText(selected);
			const anchor =
				selection?.anchorNode instanceof Element
					? selection.anchorNode
					: selection?.anchorNode?.parentElement;
			setLinkUrl(anchor?.closest("a")?.getAttribute("href") ?? "");
			setLinkOpen(true);
		};

		useImperativeHandle(ref, () => ({ command, insertHtml, openLinkDialog, focus: restoreRange }));

		useEffect(() => {
			const node = editorRef.current;
			if (!node || document.activeElement === node) {
				return;
			}
			const html = commentSourceToEditorHtml(value);
			if (node.innerHTML !== html) {
				node.innerHTML = html;
			}
		}, [value]);

		useEffect(() => {
			const onSelection = () => {
				const node = editorRef.current;
				if (!node) {
					return;
				}
				const selection = window.getSelection();
				if (!selection || selection.rangeCount === 0 || !node.contains(selection.anchorNode)) {
					return;
				}
				rangeRef.current = selection.getRangeAt(0).cloneRange();
				setMarks(queryMarks());
			};
			document.addEventListener("selectionchange", onSelection);
			return () => document.removeEventListener("selectionchange", onSelection);
		}, []);

		const applyLink = () => {
			const classified = classifyCommentHref(linkUrl.trim());
			if (!classified) {
				return;
			}
			restoreRange();
			if (linkNeedsText) {
				const label = (linkText.trim() || classified.href).replace(/</g, "");
				insertHtml(`<a href="${classified.href}">${label}</a>`);
			} else {
				command("createLink", classified.href);
			}
			setLinkOpen(false);
		};

		const preventBlur = (event: React.MouseEvent) => {
			event.preventDefault();
		};

		return (
			<>
				<div className="schema-editor-comment-format">
					<Space.Compact size="small">
						<Tooltip title={langtext("general.comment_bold")}>
							<Button
								type={marks.bold ? "primary" : "default"}
								icon={<BoldOutlined />}
								onMouseDown={preventBlur}
								onClick={() => command("bold")}
							/>
						</Tooltip>
						<Tooltip title={langtext("general.comment_italic")}>
							<Button
								type={marks.italic ? "primary" : "default"}
								icon={<ItalicOutlined />}
								onMouseDown={preventBlur}
								onClick={() => command("italic")}
							/>
						</Tooltip>
						<Tooltip title={langtext("general.comment_underline")}>
							<Button
								type={marks.underline ? "primary" : "default"}
								icon={<UnderlineOutlined />}
								onMouseDown={preventBlur}
								onClick={() => command("underline")}
							/>
						</Tooltip>
						<Tooltip title={langtext("general.comment_strike")}>
							<Button
								type={marks.strike ? "primary" : "default"}
								icon={<StrikethroughOutlined />}
								onMouseDown={preventBlur}
								onClick={() => command("strikeThrough")}
							/>
						</Tooltip>
					</Space.Compact>
					<Space.Compact size="small">
						<Tooltip title={langtext("general.comment_link")}>
							<Button icon={<LinkOutlined />} onMouseDown={preventBlur} onClick={openLinkDialog} />
						</Tooltip>
						<Tooltip title={langtext("general.comment_ul")}>
							<Button
								icon={<UnorderedListOutlined />}
								onMouseDown={preventBlur}
								onClick={() => command("insertUnorderedList")}
							/>
						</Tooltip>
						<Tooltip title={langtext("general.comment_ol")}>
							<Button
								icon={<OrderedListOutlined />}
								onMouseDown={preventBlur}
								onClick={() => command("insertOrderedList")}
							/>
						</Tooltip>
					</Space.Compact>
					{onIccmClick ? (
						<Button size="small" onMouseDown={preventBlur} onClick={onIccmClick}>
							{langtext("general.iccm_link_insert")}
						</Button>
					) : null}
				</div>
				<div
					ref={editorRef}
					className="schema-editor-field-value schema-editor-comment-md schema-editor-comment-wysiwyg Input"
					contentEditable
					role="textbox"
					aria-multiline="true"
					data-placeholder={placeholder}
					suppressContentEditableWarning
					onInput={emit}
					onPaste={(event) => {
						event.preventDefault();
						const html = event.clipboardData.getData("text/html");
						const text = event.clipboardData.getData("text/plain");
						if (html) {
							insertHtml(html);
						} else {
							command("insertText", text);
						}
					}}
					onClick={(event) => {
						const node = event.target instanceof Node ? event.target : null;
						const from = node instanceof Element ? node : node?.parentElement;
						const anchor = from?.closest("a");
						if (!anchor) {
							return;
						}
						event.preventDefault();
						event.stopPropagation();
						const raw = anchor.getAttribute("href") || (anchor as HTMLAnchorElement).href || "";
						const classified = classifyCommentHref(raw);
						if (classified?.kind === "iccm") {
							openIccmHref(classified.href);
							return;
						}
						if (classified?.kind === "web") {
							window.open(classified.href, "_blank", "noopener,noreferrer");
						}
					}}
					onMouseOver={(event) => {
						const node = event.target instanceof Node ? event.target : null;
						const from = node instanceof Element ? node : node?.parentElement;
						const anchor = from?.closest("a");
						setHoverHref(anchor?.getAttribute("href") || undefined);
					}}
					onMouseOut={(event) => {
						if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
							setHoverHref(undefined);
						}
					}}
					onFocus={() => {
						document.execCommand("defaultParagraphSeparator", false, "p");
					}}
				/>
				{hoverHref ? <div className="schema-editor-comment-link-hint">{hoverHref}</div> : null}
				<Modal
					open={linkOpen}
					title={langtext("general.comment_link_title")}
					okText={langtext("general.comment_link_apply")}
					onCancel={() => setLinkOpen(false)}
					onOk={applyLink}
					okButtonProps={{ disabled: !classifyCommentHref(linkUrl.trim()) }}
					destroyOnClose
				>
					<Input
						value={linkUrl}
						onChange={(event) => setLinkUrl(event.target.value)}
						placeholder="https://"
						style={{ marginBottom: linkNeedsText ? 8 : 0 }}
					/>
					{linkNeedsText ? (
						<Input
							value={linkText}
							onChange={(event) => setLinkText(event.target.value)}
							placeholder={langtext("general.comment_link_text")}
						/>
					) : null}
				</Modal>
			</>
		);
	}
);

CommentWysiwygEditor.displayName = "CommentWysiwygEditor";

export default CommentWysiwygEditor;
