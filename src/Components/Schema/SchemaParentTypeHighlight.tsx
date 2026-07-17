import React, { Fragment } from "react";
import { isAllowedParentForChildSchema } from "../../lib/schemaParentRestrictions";

interface SchemaParentTypeHighlightProps {
	value: string;
	highlightTokens?: Set<string> | null;
	emptyPlaceholder?: string;
}

export function SchemaParentTypeHighlight({
	value,
	highlightTokens,
	emptyPlaceholder = "—",
}: SchemaParentTypeHighlightProps) {
	if (!value) {
		return <>{emptyPlaceholder}</>;
	}

	const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
	if (parts.length === 0) {
		return <>{emptyPlaceholder}</>;
	}

	const shouldHighlight = (part: string) =>
		!!highlightTokens && highlightTokens.has(part);

	return (
		<>
			{parts.map((part, index) => (
				<Fragment key={`${part}-${index}`}>
					{index > 0 ? ", " : null}
					{shouldHighlight(part) ? (
						<mark className="schema-parent-type-highlight">{part}</mark>
					) : (
						part
					)}
				</Fragment>
			))}
		</>
	);
}

interface SchemaParentTypeCellProps {
	type: string;
	id: string;
	childWhitelist: string[];
	childBlacklist: string[];
}

export function SchemaParentTypeCell({
	type,
	id,
	childWhitelist,
	childBlacklist,
}: SchemaParentTypeCellProps) {
	const highlighted =
		childWhitelist.length > 0 &&
		isAllowedParentForChildSchema(type, id, childWhitelist, childBlacklist);

	if (!highlighted) {
		return <>{type}</>;
	}

	return <mark className="schema-parent-type-highlight">{type}</mark>;
}
