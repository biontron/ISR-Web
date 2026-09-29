import React, { ReactNode } from "react";
import SchemaEditorPathTooltip from "./SchemaEditorPathTooltip";

interface SchemaEditorPathTitleProps {
	title: ReactNode;
	mstPath?: string;
	mstValue?: unknown;
	schemaPath?: string;
	schemaTypeLabel?: string;
}

const SchemaEditorPathTitle: React.FC<SchemaEditorPathTitleProps> = ({
	title,
	mstPath,
	mstValue,
	schemaPath,
	schemaTypeLabel,
}) => {
	if (!mstPath && schemaPath === undefined) {
		return <>{title}</>;
	}
	return (
		<SchemaEditorPathTooltip
			mstPath={mstPath}
			mstValue={mstValue}
			schemaPath={schemaPath}
			schemaTypeLabel={schemaTypeLabel}
		>
			<span className="card-collapse__title-text">{title}</span>
		</SchemaEditorPathTooltip>
	);
};

export default SchemaEditorPathTitle;
