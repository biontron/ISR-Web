import React, { useEffect, useRef, useState } from "react";
import { Button, Input, Radio } from "antd";
import type { TextAreaRef } from "antd/es/input/TextArea";
import { useLangtext } from "../../lib/common";
import { IccmDockPreset, insertTextAtCursor } from "../../lib/iccmNoteLink";
import CommentMarkdownView from "./CommentMarkdownView";
import CommentWysiwygEditor, { CommentWysiwygEditorHandle } from "./CommentWysiwygEditor";
import IccmLinkWizard from "./IccmLinkWizard";

type CommentEditorMode = "source" | "wysiwyg";

type IccmCommentControlProps = {
	value: string;
	onChange?: (value: string) => void;
	disabled?: boolean;
	canEdit: boolean;
	presets?: IccmDockPreset[];
	placeholder?: string;
};

export function IccmNoteView({ value }: { value: string }) {
	return <CommentMarkdownView value={value} />;
}

const IccmCommentControl: React.FC<IccmCommentControlProps> = ({
	value,
	onChange,
	disabled = false,
	canEdit,
	presets = [],
	placeholder,
}) => {
	const langtext = useLangtext();
	const textAreaRef = useRef<TextAreaRef>(null);
	const wysiwygRef = useRef<CommentWysiwygEditorHandle>(null);
	const pendingCursor = useRef<number | null>(null);
	const [draft, setDraft] = useState(value);
	const [wizardOpen, setWizardOpen] = useState(false);
	const [mode, setMode] = useState<CommentEditorMode>("wysiwyg");
	const editing = canEdit && !disabled;

	useEffect(() => {
		const textarea = textAreaRef.current?.resizableTextArea?.textArea;
		if (textarea && document.activeElement === textarea) {
			return;
		}
		setDraft(value);
	}, [value]);

	useEffect(() => {
		if (mode !== "source" || pendingCursor.current == null) {
			return;
		}
		const cursor = pendingCursor.current;
		pendingCursor.current = null;
		const node = textAreaRef.current?.resizableTextArea?.textArea;
		if (!node) {
			return;
		}
		node.focus();
		node.setSelectionRange(cursor, cursor);
	}, [mode, draft]);

	const commit = (next: string) => {
		setDraft(next);
		onChange?.(next);
	};

	const handleInsert = (snippet: string) => {
		setWizardOpen(false);
		if (editing && mode === "wysiwyg") {
			wysiwygRef.current?.insertHtml(snippet);
			return;
		}
		const textarea = textAreaRef.current?.resizableTextArea?.textArea;
		const start = textarea?.selectionStart ?? draft.length;
		const end = textarea?.selectionEnd ?? start;
		const { next, cursor } = insertTextAtCursor(draft, snippet, start, end);
		commit(next);
		pendingCursor.current = cursor;
		setMode("source");
	};

	return (
		<div className="schema-editor-comment">
			<div className="schema-editor-comment-toolbar">
				{editing && mode === "source" ? (
					<Button size="small" onClick={() => setWizardOpen(true)}>
						{langtext("general.iccm_link_insert")}
					</Button>
				) : (
					<span />
				)}
				<Radio.Group
					size="small"
					optionType="button"
					value={mode}
					onChange={(event) => setMode(event.target.value as CommentEditorMode)}
					options={[
						{ label: langtext("general.comment_mode_wysiwyg"), value: "wysiwyg" },
						{ label: langtext("general.comment_mode_source"), value: "source" },
					]}
				/>
			</div>
			{mode === "source" ? (
				editing ? (
					<Input.TextArea
						ref={textAreaRef}
						className="schema-editor-field-input schema-editor-comment-source"
						value={draft}
						autoSize={{ minRows: 4, maxRows: 12 }}
						onChange={(event) => commit(event.target.value)}
						placeholder={placeholder || langtext("general.comment_source_placeholder")}
					/>
				) : (
					<pre className="schema-editor-field-value schema-editor-comment-source-view Input">
						{draft || value || "\u00a0"}
					</pre>
				)
			) : editing ? (
				<CommentWysiwygEditor
					ref={wysiwygRef}
					value={draft}
					onChange={commit}
					placeholder={placeholder || langtext("general.comment_source_placeholder")}
					onIccmClick={() => setWizardOpen(true)}
				/>
			) : (
				<CommentMarkdownView value={draft || value} />
			)}
			<IccmLinkWizard
				open={wizardOpen}
				presets={presets}
				onCancel={() => setWizardOpen(false)}
				onInsert={handleInsert}
			/>
		</div>
	);
};

export default IccmCommentControl;
