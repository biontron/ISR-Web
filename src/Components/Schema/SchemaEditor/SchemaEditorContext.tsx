import React, { createContext, useContext } from "react";
import { ISchemaGroupModel } from "../../../Stores/Models/SchemaGroup.Model";

export interface SchemaChooseOnAddRequest {
	path: string;
	group: ISchemaGroupModel;
	onComplete: (entry: Record<string, unknown>) => void;
	onCancel: () => void;
}

export interface SchemaEditorContextValue {
	/** Schema-Typ, z. B. ANY-PROPERTIES, COMPONENT-DOCKS, CONNECTION */
	schemaName?: string;
	/** Daten-Einstiegspunkt am Element: "", "properties", "settings" */
	dataEntryPath: string;
	/** Generische Choose-Pipeline bei leerem group.items[] (z. B. dockparts) */
	requestChooseOnAdd?: (request: SchemaChooseOnAddRequest) => void;
}

const SchemaEditorContext = createContext<SchemaEditorContextValue>({
	dataEntryPath: "",
});

export function useSchemaEditorContext(): SchemaEditorContextValue {
	return useContext(SchemaEditorContext);
}

export const SchemaEditorContextProvider = SchemaEditorContext.Provider;

export default SchemaEditorContext;
