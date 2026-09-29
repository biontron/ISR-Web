import React from "react";
import { observer } from "mobx-react";
import { getValueByPath } from "../../../../lib/path";
import SchemaEditorDockpartBasedOn, {
	findDockForEntryPath,
} from "../SchemaEditorDockpartBasedOn";
import { rootStore } from "../../../../Stores/Root.Store";
import type { SchemaWizardContext } from "../../../../lib/schemaWizards";

const DockpartBasedOnWizard: React.FC<SchemaWizardContext> = ({
	element,
	pathPrefix,
	canEdit,
	mstPath,
}) => {
	const dockpart = getValueByPath(element, mstPath || pathPrefix);
	const dock = findDockForEntryPath(element, mstPath || pathPrefix);
	return (
		<SchemaEditorDockpartBasedOn
			dockpart={dockpart}
			dock={dock}
			elementData={element}
			canEdit={canEdit}
			schemas={rootStore.configSchemas.dockparts}
		/>
	);
};

export default observer(DockpartBasedOnWizard);
