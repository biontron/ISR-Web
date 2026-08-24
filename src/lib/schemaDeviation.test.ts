import {
	findExtraPathsInScope,
	findStructuralMissingInScope,
	getFieldDefaultValue,
	hasSchemaValidationErrorsInScope,
	isFieldRuleViolated,
	isFieldStructurallyMissing,
	isGroupStructurallyMissing,
	isGroupUsageOutOfBounds,
	isMandatoryFieldUnfilled,
	isMandatoryFieldUnfilledFromDisplay,
	isMandatoryFieldMissing,
	isMandatoryGroupMissing,
	isOptionalGroupWithoutInstances,
	isFixedObjectGroup,
	isVariableGroup,
	canAddCollectionEntry,
	buildSchemaDataPath,
	resolveSchemaValidationScope,
	shouldValidateGroupContents,
} from "./schemaDeviation";
import { ISchemaFieldModel } from "../Stores/Models/SchemaField.Model";
import { ISchemaGroupModel } from "../Stores/Models/SchemaGroup.Model";
import { ISchemaItem } from "../Stores/Types/SchemaItem";

function createField(
	itemName: string,
	minUsage = 1,
	overrides: Partial<ISchemaFieldModel> = {}
): ISchemaFieldModel {
	return {
		kind: "field",
		order: 1,
		dataStructure: { itemName, default: undefined, nullable: false },
		formProperties: { label: { de: itemName, en: itemName } },
		fieldType: "string",
		itemFlags: { readonly: false, hidden: false, nullable: false },
		minUsage,
		maxUsage: 1,
		...overrides,
	} as unknown as ISchemaFieldModel;
}

function createGroup(
	itemName: string,
	items: ISchemaItem[],
	collectionType: "array" | "map" = "array",
	minUsage = 0,
	maxUsage = 99
): ISchemaGroupModel {
	return {
		kind: "group",
		order: 1,
		dataStructure: { itemName },
		formProperties: { label: { de: itemName, en: itemName } },
		itemFlags: { readonly: false, hidden: false },
		minUsage,
		maxUsage,
		collectionType,
		items,
	} as unknown as ISchemaGroupModel;
}

describe("schemaDeviation", () => {
	describe("A) content validation", () => {
		it("detects rule violations", () => {
			const field = createField("code", 1, { rules: "^[A-Z]+$" });
			expect(isFieldRuleViolated(field, "abc")).toBe(true);
			expect(isFieldRuleViolated(field, "ABC")).toBe(false);
			expect(isFieldRuleViolated(field, "")).toBe(false);
		});

		it("detects mandatory unfilled fields when value is empty string", () => {
			const field = createField("name", 1);
			const data = { name: "" };

			expect(isMandatoryFieldUnfilled(data, "name", field)).toBe(true);
			expect(isFieldStructurallyMissing(data, "name", field)).toBe(false);
		});

		it("nullable Pflichtfeld akzeptiert Leerstring", () => {
			const field = createField("subType", 1, {
				itemFlags: { readonly: true, hidden: false, nullable: true },
				dataStructure: { itemName: "subType", default: "", nullable: true },
			});
			const data = { subType: "" };

			expect(isMandatoryFieldUnfilled(data, "subType", field)).toBe(false);
			expect(isMandatoryFieldUnfilledFromDisplay(field, "")).toBe(false);
		});

		it("applies typed default values", () => {
			const field = createField("count", 1, {
				fieldType: "number",
				dataStructure: { itemName: "count", default: "42", nullable: false },
			});

			expect(getFieldDefaultValue(field)).toBe(42);
		});

		it("detects variable group usage out of bounds", () => {
			const group = createGroup("connectors", [createField("id")], "array", 1, 3);
			expect(isVariableGroup(group)).toBe(true);
			expect(isGroupUsageOutOfBounds({ connectors: [] }, "connectors", group)).toBe(true);
			expect(
				isGroupUsageOutOfBounds(
					{ connectors: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }] },
					"connectors",
					group
				)
			).toBe(true);
			expect(isGroupUsageOutOfBounds({ connectors: [{ id: "1" }] }, "connectors", group)).toBe(false);
		});

		it("does not flag fixed groups for usage out of bounds styling", () => {
			const group = createGroup("style", [createField("bgColor")], "array", 1, 1);
			expect(isVariableGroup(group)).toBe(false);
			expect(isGroupUsageOutOfBounds({}, "style", group)).toBe(false);
		});

	});

	describe("B) structural violations", () => {
		it("detects structurally missing mandatory fields", () => {
			const field = createField("name", 1);
			const data = { other: "value" };

			expect(isFieldStructurallyMissing(data, "name", field)).toBe(true);
			expect(isMandatoryFieldUnfilled(data, "name", field)).toBe(false);
		});

		it("materialisiert keine Pflichtfelder unter fehlendem Array-Eintrag", () => {
			const field = createField("type", 1);
			const data = { parent: {} };

			expect(isFieldStructurallyMissing(data, "parent.whitelist[0].type", field)).toBe(false);
		});

		it("detects missing or empty required group structures", () => {
			const group = createGroup("connectors", [createField("id")], "array", 1, 5);

			expect(isGroupStructurallyMissing({}, "connectors", group)).toBe(true);
			expect(isGroupStructurallyMissing({ connectors: [] }, "connectors", group)).toBe(true);
			expect(isGroupStructurallyMissing({ connectors: [{ id: "1" }] }, "connectors", group)).toBe(false);
		});

		it("detects top-level keys not in schema", () => {
			const schemaItems = [createField("name"), createField("type")];
			const data = {
				name: "Server",
				type: "HARDWARE",
				legacyField: "unexpected",
			};

			const extras = findExtraPathsInScope(data, schemaItems, "");

			expect(extras).toEqual([{ path: "legacyField", value: "unexpected" }]);
		});

		it("detects nested extra fields inside known array groups", () => {
			const schemaItems = [
				createGroup("connectors", [createField("id"), createField("name")], "array"),
			];
			const data = {
				connectors: [{ id: "1", name: "Internet", protocol: "IPv4" }],
			};

			const extras = findExtraPathsInScope(data, schemaItems, "");

			expect(extras).toEqual([{ path: "connectors[0].protocol", value: "IPv4" }]);
		});

		it("detects array entries beyond maxUsage", () => {
			const schemaItems = [
				createGroup("connectors", [createField("id")], "array", 0, 1),
			];
			const data = {
				connectors: [{ id: "1" }, { id: "2" }],
			};

			const extras = findExtraPathsInScope(data, schemaItems, "");

			expect(extras).toEqual([{ path: "connectors[1]", value: { id: "2" } }]);
		});

		it("does not flag optional empty groups or their children as missing", () => {
			const group = createGroup(
				"connectors",
				[createField("id"), createField("name")],
				"array",
				0,
				5
			);
			const data = {};

			expect(isOptionalGroupWithoutInstances(group, undefined)).toBe(true);
			expect(isGroupStructurallyMissing(data, "connectors", group)).toBe(false);
			expect(shouldValidateGroupContents(group, undefined)).toBe(false);
			expect(findStructuralMissingInScope(data, [group], "")).toEqual([]);
		});

		it("validates children once optional group has instances", () => {
			const group = createGroup(
				"connectors",
				[createField("id"), createField("name", 1)],
				"array",
				0,
				5
			);
			const data = { connectors: [{ name: "Internet" }] };

			expect(isOptionalGroupWithoutInstances(group, data.connectors)).toBe(false);
			expect(findStructuralMissingInScope(data, [group], "")).toEqual([
				{ path: "connectors[0].id", kind: "field" },
			]);
		});

		it("collects structural missing paths in scope", () => {
			const schemaItems = [createField("name"), createGroup("connectors", [createField("id")], "array", 1, 5)];
			const data = { name: undefined, connectors: [] };

			const missing = findStructuralMissingInScope(data, schemaItems, "");

			expect(missing).toEqual([
				{ path: "name", kind: "field" },
				{ path: "connectors", kind: "group" },
			]);
		});

		it("reports missing mandatory array group as group, not child fields", () => {
			const responsiblesGroup = createGroup(
				"responsibles",
				[
					createField("givenName", 1),
					createField("familyName", 1),
				],
				"array",
				1,
				5
			);
			const data = { properties: {} };

			const missing = findStructuralMissingInScope(
				data,
				[responsiblesGroup],
				"properties"
			);

			expect(missing).toEqual([{ path: "properties.responsibles", kind: "group" }]);
		});

		it("handles ANY-DEFINITION-like fixed object groups without false extras", () => {
			const descriptionGroup = createGroup(
				"description",
				[
					createField("baseType"),
					createField("subType"),
					createField("category"),
				],
				"map",
				1,
				1
			);
			const definitionWrapper = createGroup(
				"definition",
				[createField("name"), descriptionGroup],
				"map",
				1,
				1
			);
			const data = {
				id: "asset-1",
				properties: { style: { bgColor: "#fff" } },
				definition: {
					name: "Server",
					description: {
						baseType: "HARDWARE",
						subType: "SERVER",
						category: "IT",
					},
				},
			};

			const scope = resolveSchemaValidationScope([definitionWrapper], "");
			expect(scope.pathPrefix).toBe("definition");
			expect(isFixedObjectGroup(definitionWrapper)).toBe(true);

			expect(
				findExtraPathsInScope(data, scope.schemaItems, scope.pathPrefix)
			).toEqual([]);
			expect(
				findStructuralMissingInScope(data, scope.schemaItems, scope.pathPrefix)
			).toEqual([]);
		});
	});

	describe("schema entry points (ANY-PROPERTIES / ANY-DEFINITION)", () => {
		it("buildSchemaDataPath avoids duplicate wrapper segment", () => {
			const propertiesWrapper = createGroup(
				"properties",
				[createField("style")],
				"map",
				1,
				1
			);
			const definitionWrapper = createGroup(
				"definition",
				[createField("name")],
				"map",
				1,
				1
			);
			const deviceTypeGroup = createGroup(
				"devicetype",
				[createField("model")],
				"map",
				1,
				1
			);

			expect(buildSchemaDataPath("properties", propertiesWrapper)).toBe("properties");
			expect(buildSchemaDataPath("", definitionWrapper)).toBe("definition");
			expect(buildSchemaDataPath("settings", deviceTypeGroup)).toBe("settings.devicetype");
		});

		it("buildSchemaDataPath resolves nested groups inside array entries (COMPONENT-DOCKS dockparts)", () => {
			const dockpartsGroup = createGroup("dockparts", [], "array", 0, 50);
			const dockEntryWrapper = createGroup(
				"dock",
				[createField("id", 1), createField("type", 1), dockpartsGroup],
				"map",
				1,
				1
			);
			const docksGroup = createGroup(
				"docks",
				[createField("id", 1), createField("type", 1), dockpartsGroup],
				"array",
				0,
				20
			);

			expect(buildSchemaDataPath("docks[0]", dockpartsGroup)).toBe("docks[0].dockparts");
			expect(buildSchemaDataPath("docks[0]", dockEntryWrapper)).toBe("docks[0]");
		});

		it("buildSchemaDataPath resolved settings/address unter dockparts", () => {
			const addressGroup = createGroup("address", [createField("ip")], "map", 1, 1);
			const settingsGroup = createGroup("settings", [addressGroup], "map", 1, 1);

			expect(buildSchemaDataPath("docks[0].dockparts[0]", settingsGroup)).toBe(
				"docks[0].dockparts[0].settings"
			);
			expect(buildSchemaDataPath("docks[0].dockparts[0].settings", addressGroup)).toBe(
				"docks[0].dockparts[0].settings.address"
			);
		});

		it("buildSchemaDataPath für flache Connection links[n]-Struktur", () => {
			const linkpartsGroup = createGroup(
				"linkparts",
				[createField("fromDockpartRef")],
				"array",
				0,
				20
			);
			const metadataGroup = createGroup(
				"metadata",
				[createField("status")],
				"map",
				1,
				1
			);
			const linksGroup = createGroup(
				"links",
				[createField("id"), createField("title"), metadataGroup, linkpartsGroup],
				"array",
				0,
				50
			);

			expect(buildSchemaDataPath("", linksGroup)).toBe("links");
			expect(buildSchemaDataPath("links[0]", metadataGroup)).toBe("links[0].metadata");
			expect(buildSchemaDataPath("links[0]", linkpartsGroup)).toBe("links[0].linkparts");
		});

		it("resolveSchemaValidationScope scopes ANY-PROPERTIES to element.properties", () => {
			const propertiesWrapper = createGroup(
				"properties",
				[
					createField("style"),
					createGroup("responsibles", [createField("givenName")], "array", 0, 5),
				],
				"map",
				1,
				1
			);
			const scope = resolveSchemaValidationScope([propertiesWrapper], "properties");

			expect(scope.pathPrefix).toBe("properties");
			expect(scope.schemaItems).toBe(propertiesWrapper.items);

			const data = {
				id: "asset-1",
				definition: { name: "X" },
				properties: { style: { bgColor: "#fff" } },
			};

			expect(findExtraPathsInScope(data, scope.schemaItems, scope.pathPrefix)).toEqual([]);
		});

		it("resolveSchemaValidationScope scopes ANY-DEFINITION to element.definition", () => {
			const definitionWrapper = createGroup(
				"definition",
				[createField("name"), createField("baseType")],
				"map",
				1,
				1
			);
			const scope = resolveSchemaValidationScope([definitionWrapper], "");

			expect(scope.pathPrefix).toBe("definition");
			expect(scope.schemaItems).toBe(definitionWrapper.items);
		});

		it("hasSchemaValidationErrorsInScope erkennt Regelverstöße und löst sie auf", () => {
			const typeField = createField("type", 1);
			typeField.rules = "[A-Z0-9_]+";
			const schemaItems = [typeField];
			const invalid = { type: "abc" };
			const valid = { type: "ABC" };

			expect(hasSchemaValidationErrorsInScope(invalid, schemaItems, "")).toBe(true);
			expect(hasSchemaValidationErrorsInScope(valid, schemaItems, "")).toBe(false);
		});

		it("COMPONENT-DOCKS: dock.type bleibt type — kein baseType als Extra-Daten", () => {
			const schemaItems = [
				createGroup(
					"docks",
					[
						createField("id", 1),
						createField("type", 1),
						createGroup("dockparts", [createField("id")], "array", 0, 50),
					],
					"array",
					0,
					20
				),
			];
			const data = {
				docks: [
					{
						id: "dAbc123456",
						type: "GENERIC",
						dockparts: [],
					},
				],
			};

			expect(findExtraPathsInScope(data, schemaItems, "")).toEqual([]);
			expect(findStructuralMissingInScope(data, schemaItems, "")).toEqual([]);
		});

		it("Dockpart: Kernfelder und settings.address gelten als zulässig", () => {
			const addressGroup = createGroup(
				"address",
				[
					createField("ip", 1),
					createField("netmask", 1),
					createField("type", 1),
				],
				"map",
				1,
				1
			);
			const schemaItems = [addressGroup];
			const data = {
				docks: [
					{
						dockparts: [
							{
								id: "dp1",
								type: "IPv4",
								label: "IPv4",
								protocol: "IP",
								versions: [],
								basedOn: [],
								settings: {
									address: {
										type: "V4",
										netmask: "24",
										ip: "",
									},
								},
							},
						],
					},
				],
			};

			expect(
				findExtraPathsInScope(data, schemaItems, "docks[0].dockparts[0]")
			).toEqual([]);
			expect(
				findStructuralMissingInScope(data, schemaItems, "docks[0].dockparts[0]")
			).toEqual([]);
		});
	});

	describe("canAddCollectionEntry", () => {
		it("erlaubt Einträge wenn maxUsage unbegrenzt (<= 0) ist", () => {
			expect(canAddCollectionEntry(0, 0)).toBe(true);
			expect(canAddCollectionEntry(0, 5)).toBe(true);
			expect(canAddCollectionEntry(-1, 2)).toBe(true);
		});

		it("stoppt bei erreichtem maxUsage", () => {
			expect(canAddCollectionEntry(20, 0)).toBe(true);
			expect(canAddCollectionEntry(20, 19)).toBe(true);
			expect(canAddCollectionEntry(20, 20)).toBe(false);
		});
	});

	describe("legacy aliases", () => {
		it("isMandatoryFieldMissing combines structural and content checks", () => {
			const field = createField("name", 1);
			expect(isMandatoryFieldMissing({ name: "" }, "name", field)).toBe(true);
			expect(isMandatoryFieldMissing({}, "name", field)).toBe(true);
		});

		it("isMandatoryGroupMissing combines structural and usage checks", () => {
			const group = createGroup("connectors", [createField("id")], "array", 1, 3);
			expect(isMandatoryGroupMissing({}, "connectors", group)).toBe(true);
			expect(isMandatoryGroupMissing({ connectors: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }] }, "connectors", group)).toBe(true);
		});
	});
});
