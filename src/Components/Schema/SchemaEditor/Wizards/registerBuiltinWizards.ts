import { registerSchemaWizard } from "../../../../lib/schemaWizards";
import MarkdownWizard from "./MarkdownWizard";
import DockpartBasedOnWizard from "./DockpartBasedOnWizard";
import DockpartsWizard from "./DockpartsWizard";
import AddressFamilyWizard from "./AddressFamilyWizard";
import ElementIdentityWizard from "./ElementIdentityWizard";

let registered = false;

export function registerBuiltinSchemaWizards(): void {
	if (registered) {
		return;
	}
	registered = true;
	registerSchemaWizard("markdown", MarkdownWizard);
	registerSchemaWizard("dockpartBasedOn", DockpartBasedOnWizard);
	registerSchemaWizard("dockparts", DockpartsWizard);
	registerSchemaWizard("ipv4", AddressFamilyWizard);
	registerSchemaWizard("ipv6", AddressFamilyWizard);
	registerSchemaWizard("elementIdentity", ElementIdentityWizard);
}
