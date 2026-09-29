import { ISchemaDefinition } from "../Interfaces/SchemaDefinition";
import { registerMappingSchemaWizards } from "../Components/Mappings/registerMappingWizards";

registerMappingSchemaWizards();

const groupFlags = { readonly: false, hidden: false };

function hostGroup(
	itemName: string,
	wizardType: string,
	xpath: string,
	label: { und: string; de: string }
) {
	return {
		kind: "group" as const,
		order: 1,
		dataStructure: { itemName, xpath },
		formProperties: { label },
		wizardType,
		itemFlags: groupFlags,
		minUsage: 0,
		maxUsage: 1,
		collectionType: "map" as const,
		items: [],
	};
}

export const ASSIGNMENTS_HOST_SCHEMA = {
	id: "ANY-ASSIGNMENTS",
	type: "INTERNAL",
	items: [
		hostGroup("elementIdRefs", "elementMapping", "class='View' or class='Group' or class='Asset'", {
			und: "Assignments",
			de: "Zuordnungen",
		}),
		hostGroup("environments", "viewEnvironments", "class='View'", {
			und: "Environments",
			de: "Umgebungen",
		}),
		hostGroup("validationRules", "viewValidation", "class='View'", {
			und: "Validation rules",
			de: "Validierungsregeln",
		}),
	],
} as unknown as ISchemaDefinition;

export const CONNECTIONS_HOST_SCHEMA = {
	id: "ANY-CONNECTIONS",
	type: "INTERNAL",
	items: [
		hostGroup("connections", "connectionMapping", "class='Asset' or class='Group'", {
			und: "Connections",
			de: "Verbindungen",
		}),
	],
} as unknown as ISchemaDefinition;
