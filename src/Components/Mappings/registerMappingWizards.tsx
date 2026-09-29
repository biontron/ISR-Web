import React from "react";
import { registerSchemaWizard, type SchemaWizardContext } from "../../lib/schemaWizards";
import { getLanguageText } from "../../lib/common";
import { ISchemaGroupModel } from "../../Stores/Models/SchemaGroup.Model";
import { IAsset } from "../../Stores/Models/Asset.Model";
import { IGroup } from "../../Stores/Models/Group.Model";
import { IView } from "../../Stores/Models/View.Model";
import CardCollapse from "../../Apps/AssetManagement/Components/CardCollapse.Component";
import AssetReferenceMapping from "./AssetReferenceMapping.Component";
import ConnectionMapping from "./ConnectionMapping.Component";
import ViewEnvironmentsMapping from "./ViewEnvironmentsMapping.Component";
import ViewValidationRules from "./ViewValidationRules.Component";

let registered = false;

function MappingCard({
	schemaItem,
	children,
}: {
	schemaItem: SchemaWizardContext["schemaItem"];
	children: React.ReactNode;
}) {
	const group = schemaItem as ISchemaGroupModel;
	return (
		<CardCollapse
			title={getLanguageText(group.formProperties?.label)}
			defaultCollapsed={group.formProperties?.collapsed === true}
		>
			{children}
		</CardCollapse>
	);
}

function ElementMappingWizard({ element, schemaItem }: SchemaWizardContext) {
	if (element.class !== "View" && element.class !== "Group" && element.class !== "Asset") {
		return null;
	}
	return (
		<MappingCard schemaItem={schemaItem}>
			<AssetReferenceMapping element={element as IView | IGroup | IAsset} />
		</MappingCard>
	);
}

function ConnectionMappingWizard({ element, schemaItem, extras }: SchemaWizardContext) {
	if (element.class !== "Asset" && element.class !== "Group") {
		return null;
	}
	return (
		<MappingCard schemaItem={schemaItem}>
			<ConnectionMapping
				element={element as IAsset | IGroup}
				contextPrefill={extras?.connectionContextPrefill}
			/>
		</MappingCard>
	);
}

function ViewEnvironmentsWizard({ element, schemaItem }: SchemaWizardContext) {
	if (element.class !== "View") {
		return null;
	}
	return (
		<MappingCard schemaItem={schemaItem}>
			<ViewEnvironmentsMapping view={element as IView} />
		</MappingCard>
	);
}

function ViewValidationWizard({ element, schemaItem }: SchemaWizardContext) {
	if (element.class !== "View") {
		return null;
	}
	return (
		<MappingCard schemaItem={schemaItem}>
			<ViewValidationRules view={element as IView} />
		</MappingCard>
	);
}

export function registerMappingSchemaWizards(): void {
	if (registered) {
		return;
	}
	registered = true;
	registerSchemaWizard("elementMapping", ElementMappingWizard);
	registerSchemaWizard("connectionMapping", ConnectionMappingWizard);
	registerSchemaWizard("viewEnvironments", ViewEnvironmentsWizard);
	registerSchemaWizard("viewValidation", ViewValidationWizard);
}
