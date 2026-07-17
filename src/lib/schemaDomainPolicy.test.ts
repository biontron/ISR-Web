import { isSchemaUserCreatable, isSchemaUserEditable } from "./schemaDomainPolicy";

describe("schemaDomainPolicy", () => {
	it("reservierte INTERNAL-Schemas sind nicht editierbar", () => {
		expect(
			isSchemaUserEditable({ id: "ANY-DEFINITION", storeType: "INTERNAL" }, false)
		).toBe(false);
	});

	it("COMPONENT-Schemas sind editierbar wenn nicht read-only", () => {
		expect(isSchemaUserEditable({ id: "DEVICE", storeType: "COMPONENT" }, false)).toBe(true);
	});

	it("COMPONENT-Schemas nicht editierbar im read-only Modus", () => {
		expect(isSchemaUserEditable({ id: "DEVICE", storeType: "COMPONENT" }, true)).toBe(false);
	});

	it("isSchemaUserCreatable für COMPONENT und DOCKPART", () => {
		expect(isSchemaUserCreatable("COMPONENT", false)).toBe(true);
		expect(isSchemaUserCreatable("DOCKPART", false)).toBe(true);
		expect(isSchemaUserCreatable("INTERNAL", false)).toBe(false);
	});
});
