import React, { createContext, useContext } from "react";
import { ISchemaGroupModel } from "../../../Stores/Models/SchemaGroup.Model";
import type { ElementMarkFlags } from "../../../lib/elementXPathValidation";
import type { SchemaWizardExtras } from "../../../lib/schemaWizards";

export interface SchemaChooseOnAddRequest {
	path: string;
	group: ISchemaGroupModel;
	onComplete: (entry: Record<string, unknown>) => void;
	onCancel: () => void;
}

export type SchemaEditorWizardExtras = SchemaWizardExtras;

export interface SchemaEditorContextValue {
	/** Schema-Typ, z. B. ANY-PROPERTIES, COMPONENT-DOCKS, CONNECTION */
	schemaName?: string;
	/** Generische Choose-Pipeline (z. B. dockparts) */
	requestChooseOnAdd?: (request: SchemaChooseOnAddRequest) => void;
	fieldMarks?: ElementMarkFlags;
	wizardExtras?: SchemaWizardExtras;
}

const SchemaEditorContext = createContext<SchemaEditorContextValue>({});

export function useSchemaEditorContext(): SchemaEditorContextValue {
	return useContext(SchemaEditorContext);
}

export const SchemaEditorContextProvider = SchemaEditorContext.Provider;

export default SchemaEditorContext;
