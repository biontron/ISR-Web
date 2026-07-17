import {
	isAllowedParentElementType,
	isAllowedParentForChildSchema,
	isParentTypeInSchemaBlacklist,
	isParentTypeInSchemaWhitelist,
	parentTypeHighlightTokens,
} from "./schemaParentRestrictions";

describe("schemaParentRestrictions", () => {
	it("erkennt Whitelist- und Blacklist-Treffer", () => {
		expect(isParentTypeInSchemaWhitelist("ASSET", ["ASSET", "GROUP"])).toBe(true);
		expect(isParentTypeInSchemaWhitelist("VIEW", ["ANY"])).toBe(true);
		expect(isParentTypeInSchemaBlacklist("ASSET", ["ANY"])).toBe(true);
	});

	it("prüft zulässige Parent-Element-Typen", () => {
		expect(isAllowedParentElementType("ASSET", ["ASSET", "GROUP"], [])).toBe(true);
		expect(isAllowedParentElementType("VIEW", ["ASSET"], [])).toBe(false);
		expect(isAllowedParentElementType("ASSET", ["ANY"], ["ASSET"])).toBe(false);
	});

	it("prüft Parent anhand Typ oder Schema-ID", () => {
		expect(isAllowedParentForChildSchema("ASSET", "DEVICE", ["ASSET"], [])).toBe(true);
		expect(isAllowedParentForChildSchema("VIEW", "DEVICE", ["DEVICE"], [])).toBe(true);
		expect(isAllowedParentForChildSchema("VIEW", "LIGHT", ["ASSET"], [])).toBe(false);
	});

	it("liefert Highlight-Tokens aus der Whitelist", () => {
		expect(parentTypeHighlightTokens([" ASSET", "GROUP"])).toEqual(new Set(["ASSET", "GROUP"]));
	});
});
