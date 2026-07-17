/*
# SPDX-License-Identifier: GPL-2.0*/

import React from "react";
import { StructuralMissingEntry } from "../../../lib/schemaDeviation";
import { useLangtext } from "../../../lib/common";

interface SchemaEditorStructuralMissingProps {
	entries: StructuralMissingEntry[];
}

const SchemaEditorStructuralMissing: React.FC<SchemaEditorStructuralMissingProps> = ({
	entries,
}) => {
	const langtext = useLangtext();

	if (entries.length === 0) {
		return null;
	}

	return (
		<div className="schema-editor-structural-missing">
			{entries.map((entry) => (
				<div key={entry.path} className="schema-editor-structural-missing-item">
					<div className="schema-editor-structural-missing-item__title">
						{langtext("schema_editor.structural_missing")}
					</div>
					<div className="schema-editor-structural-missing-path">{entry.path}</div>
				</div>
			))}
		</div>
	);
};

export default SchemaEditorStructuralMissing;
