import type { ComponentType } from "react";
import { IElement } from "../Stores/Models/Element.Model";
import { ISchemaItem } from "../Stores/Types/SchemaItem";

export const SCHEMA_WIZARD_TYPES = [
	"markdown",
	"dockpartBasedOn",
	"dockparts",
	"elementMapping",
	"connectionMapping",
	"viewEnvironments",
	"viewValidation",
	"ipv4",
	"ipv6",
	"elementIdentity",
] as const;

export type SchemaWizardType = (typeof SCHEMA_WIZARD_TYPES)[number];

export type SchemaWizardExtras = {
	connectionContextPrefill?: { contextId?: string; dockpartId?: string };
};

export type SchemaWizardContext = {
	element: IElement;
	schemaItem: ISchemaItem;
	pathPrefix: string;
	canEdit: boolean;
	depth?: number;
	mstPath: string;
	extras?: SchemaWizardExtras;
};

export type SchemaWizardComponent = ComponentType<SchemaWizardContext>;

export type SchemaWizardRegistration = {
	id: string;
	component: SchemaWizardComponent;
};

const registry = new Map<string, SchemaWizardRegistration>();

export function readSchemaWizardType(item: unknown): string {
	if (item == null || typeof item !== "object" || !("wizardType" in item)) {
		return "";
	}
	return String((item as { wizardType?: unknown }).wizardType ?? "").trim();
}

export function registerSchemaWizard(id: string, component: SchemaWizardComponent): void {
	const wizardId = id.trim();
	if (!wizardId) {
		return;
	}
	registry.set(wizardId, { id: wizardId, component });
}

export function resolveSchemaWizard(item: unknown): SchemaWizardRegistration | undefined {
	const wizardType = readSchemaWizardType(item);
	if (!wizardType) {
		return undefined;
	}
	return registry.get(wizardType);
}

export function listRegisteredSchemaWizards(): string[] {
	return Array.from(registry.keys()).sort();
}

export function clearSchemaWizardsForTests(): void {
	registry.clear();
}
