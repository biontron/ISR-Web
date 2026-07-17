/*
	========================================================================
	LICENSE AGREEMENT — siehe andere App-Dateien
	========================================================================
*/

import React from "react";
import ConfigSchemaSelector from "./Components/ConfigSchemaSelector.Component";

const SchemaManagement: React.FC = () => {
	return (
		<div className="editor-schema-management schema-management">
			<ConfigSchemaSelector />
		</div>
	);
};

export default SchemaManagement;
