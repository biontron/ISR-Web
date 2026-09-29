import {
	clearSchemaWizardsForTests,
	listRegisteredSchemaWizards,
	readSchemaWizardType,
	registerSchemaWizard,
	resolveSchemaWizard,
} from "./schemaWizards";

describe("schemaWizards", () => {
	afterEach(() => {
		clearSchemaWizardsForTests();
	});

	it("liest wizardType und fällt ohne Typ auf atomar zurück", () => {
		expect(readSchemaWizardType({ wizardType: "markdown" })).toBe("markdown");
		expect(readSchemaWizardType({ wizardType: "  ipv4  " })).toBe("ipv4");
		expect(readSchemaWizardType({ wizardType: "" })).toBe("");
		expect(readSchemaWizardType({ kind: "field" })).toBe("");
		expect(resolveSchemaWizard({ wizardType: "markdown" })).toBeUndefined();
	});

	it("löst nur registrierte Wizards auf", () => {
		const component = () => null;
		registerSchemaWizard("ipv4", component);
		expect(resolveSchemaWizard({ wizardType: "ipv4" })?.component).toBe(component);
		expect(resolveSchemaWizard({ wizardType: "ipv6" })).toBeUndefined();
		expect(listRegisteredSchemaWizards()).toEqual(["ipv4"]);
	});
});
