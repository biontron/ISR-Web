import React, { ReactNode } from "react";
import SchemaEditorPathTooltip from "./SchemaEditorPathTooltip";

interface SchemaEditorGroupEntryHeaderProps {
	title: string;
	controls?: ReactNode;
	canEdit: boolean;
	mstPath: string;
	mstValue: unknown;
	schemaPath: string;
	schemaTypeLabel: string;
}

const SchemaEditorGroupEntryHeader: React.FC<SchemaEditorGroupEntryHeaderProps> = ({
	title,
	controls,
	canEdit,
	mstPath,
	mstValue,
	schemaPath,
	schemaTypeLabel,
}) => {
	const titleContent = canEdit ? (
		<SchemaEditorPathTooltip
			mstPath={mstPath}
			mstValue={mstValue}
			schemaPath={schemaPath}
			schemaTypeLabel={schemaTypeLabel}
		>
			<span className="schema-group-entry__title-text">{title}</span>
		</SchemaEditorPathTooltip>
	) : (
		title
	);

	return (
		<div className="schema-group-entry__header">
			<span className="schema-group-entry__title">{titleContent}</span>
			{controls}
		</div>
	);
};

export default SchemaEditorGroupEntryHeader;
