import {
	NEW_ELEMENT_DEFINITION_NAME,
	findSchemaForDefinition,
	isApplicationAssignedDefinitionField,
	resolveAssetDefinitionTypesForCreate,
	resolveAssetElementType,
	resolveAssetSchemaStoreType,
	resolveElementDefinitionTypesForCreate,
	resolveElementDefinitionTypesFromSchema,
	resolveElementSchemaIconCandidates,
	resolveElementSchemaLookupId,
	resolveElementSchemaParentType,
	resolveElementSettingsSchemaName,
	resolveElementTypeDisplay,
	resolveViewDefinitionTypesForCreate,
	resolveSchemaLogicalType,
	normalizeSchemaElementKind,
	formatAssetDefinitionTypeLabel,
} from "./elementDefinitionTypes";
import { ISchemaModel } from "../Stores/Models/Schema.Model";

describe("elementDefinitionTypes", () => {
	const desktopSchema = {
		id: "DESKTOP",
		storeType: "COMPONENT",
		baseType: "COMPONENT",
		type: "DEVICE",
		subType: "DESKTOP",
	} as ISchemaModel;

	const lightSchema = {
		id: "LIGHT",
		storeType: "COMPONENT",
		baseType: "COMPONENT",
		type: "DEVICE",
		subType: "SWITCH",
	} as ISchemaModel;

	const areaGroupSchema = {
		id: "MAIN",
		storeType: "INTERNAL",
		baseType: "GROUP",
		type: "AREA",
		subType: "MAIN",
	} as ISchemaModel;

	const systemGroupSchema = {
		id: "SYSTEM",
		storeType: "INTERNAL",
		baseType: "GROUP",
		type: "SYSTEM",
		subType: "",
	} as ISchemaModel;

	const legacyAreaSchema = {
		id: "AREA",
		storeType: "COMPONENT",
		baseType: "ELEMENT",
		type: "GROUP",
		subType: "",
	} as unknown as ISchemaModel;

	const findSchema = (id: string) => {
		if (id === "LIGHT") return lightSchema;
		if (id === "DESKTOP") return desktopSchema;
		return undefined;
	};

	it("Neuanlage verwendet definition.name 'New'", () => {
		expect(NEW_ELEMENT_DEFINITION_NAME).toBe("New");
	});

	it("setzt bei Neuanlage storeType/baseType/type/subType 1:1 aus Schema (subType ≠ schema.id)", () => {
		expect(resolveElementDefinitionTypesForCreate(desktopSchema)).toEqual({
			storeType: "COMPONENT",
			baseType: "COMPONENT",
			type: "DEVICE",
			subType: "DESKTOP",
		});
		expect(resolveAssetDefinitionTypesForCreate("DESKTOP", desktopSchema)).toEqual({
			storeType: "COMPONENT",
			baseType: "COMPONENT",
			type: "DEVICE",
			subType: "DESKTOP",
		});
	});

	it("resolveViewDefinitionTypesForCreate erzwingt VIEWGROUP/VIEW", () => {
		expect(resolveViewDefinitionTypesForCreate(desktopSchema)).toEqual({
			storeType: "VIEWGROUP",
			baseType: "GROUP",
			type: "VIEW",
			subType: "DESKTOP",
		});
	});

	it("resolveElementDefinitionTypesFromSchema delegiert an Resolver", () => {
		expect(resolveElementDefinitionTypesFromSchema("LIGHT", findSchema)).toEqual({
			storeType: "COMPONENT",
			baseType: "COMPONENT",
			type: "DEVICE",
			subType: "SWITCH",
		});
	});

	it("resolveAssetElementType nutzt type", () => {
		expect(
			resolveAssetElementType({ baseType: "COMPONENT", type: "DEVICE", subType: "DESKTOP" })
		).toBe("DEVICE");
	});

	it("resolveAssetElementType ignoriert Element-Art in type", () => {
		expect(resolveAssetElementType({ baseType: "GROUP", type: "GROUP", subType: "MAIN" })).toBe("");
	});

	it("findSchemaForDefinition matcht GROUP mit type ohne subType", () => {
		expect(
			findSchemaForDefinition([areaGroupSchema, systemGroupSchema], {
				baseType: "GROUP",
				type: "AREA",
				subType: "",
			})
		).toBe(areaGroupSchema);
	});

	it("resolveElementTypeDisplay nutzt Schema-Fallback für GROUP", () => {
		expect(
			resolveElementTypeDisplay(
				{ baseType: "GROUP", type: "", subType: "MAIN" },
				[areaGroupSchema]
			)
		).toBe("AREA");
	});

	it("resolveSchemaLogicalType mappt Legacy-Schema id", () => {
		expect(resolveSchemaLogicalType(legacyAreaSchema)).toBe("AREA");
		expect(normalizeSchemaElementKind(legacyAreaSchema)).toBe("GROUP");
	});

	it("resolveElementTypeDisplay für Legacy-Group baseType=AREA", () => {
		expect(
			resolveElementTypeDisplay({ baseType: "AREA", subType: "" }, [legacyAreaSchema])
		).toBe("AREA");
	});

	it("resolveElementTypeDisplay für GROUP mit subType=Schema-ID (Legacy-Schema)", () => {
		expect(
			resolveElementTypeDisplay(
				{ baseType: "GROUP", type: "", subType: "AREA" },
				[legacyAreaSchema]
			)
		).toBe("AREA");
	});

	it("resolveAssetSchemaStoreType liest storeType", () => {
		expect(resolveAssetSchemaStoreType({ storeType: "COMPONENT", baseType: "COMPONENT" })).toBe(
			"COMPONENT"
		);
		expect(resolveAssetSchemaStoreType({ baseType: "ELEMENT" })).toBe("COMPONENT");
	});

	it("findSchemaForDefinition matcht Tripel", () => {
		const schemas = [desktopSchema, lightSchema];
		expect(
			findSchemaForDefinition(schemas, {
				baseType: "COMPONENT",
				type: "DEVICE",
				subType: "DESKTOP",
			})
		).toBe(desktopSchema);
	});

	it("resolveElementSettingsSchemaName liefert Schema-ID nach Tripel", () => {
		expect(
			resolveElementSettingsSchemaName(
				{ baseType: "COMPONENT", type: "DEVICE", subType: "DESKTOP" },
				[desktopSchema]
			)
		).toBe("DESKTOP");
	});

	it("Legacy: subType als Schema-ID wenn kein Tripel-Match", () => {
		expect(findSchemaForDefinition([desktopSchema], { subType: "DESKTOP" })).toBe(desktopSchema);
	});

	it("Legacy: baseType=ELEMENT normalisiert zu COMPONENT für Tripel-Match", () => {
		expect(
			findSchemaForDefinition([desktopSchema], {
				baseType: "ELEMENT",
				type: "DEVICE",
				subType: "DESKTOP",
			})
		).toBe(desktopSchema);
	});

	it("Legacy: Schema-ID in baseType (z. B. LIGHT)", () => {
		expect(
			findSchemaForDefinition([lightSchema], {
				baseType: "LIGHT",
				type: "DEVICE",
				subType: "",
			})
		).toBe(lightSchema);
	});

	it("Fallback: eindeutiger type wenn nur ein Schema passt", () => {
		expect(findSchemaForDefinition([lightSchema], { type: "DEVICE" })).toBe(lightSchema);
	});

	it("resolveElementSchemaLookupId deprecated — nur subType", () => {
		expect(resolveElementSchemaLookupId({ subType: "DESKTOP" })).toBe("DESKTOP");
	});

	it("resolveElementSchemaParentType nutzt type", () => {
		expect(resolveElementSchemaParentType({ baseType: "COMPONENT", type: "DEVICE" })).toBe(
			"DEVICE"
		);
	});

	it("formatAssetDefinitionTypeLabel zeigt type/subType", () => {
		expect(formatAssetDefinitionTypeLabel({ type: "DEVICE", subType: "DESKTOP" })).toBe(
			"DEVICE/DESKTOP"
		);
	});

	it("resolveElementSchemaIconCandidates", () => {
		expect(
			resolveElementSchemaIconCandidates({
				baseType: "COMPONENT",
				type: "DEVICE",
				subType: "DESKTOP",
			})
		).toEqual(["DESKTOP", "DEVICE"]);
	});

	it("isApplicationAssignedDefinitionField für Asset/Group/View", () => {
		expect(isApplicationAssignedDefinitionField({ class: "Asset" }, "storeType", "definition.storeType")).toBe(
			true
		);
		expect(isApplicationAssignedDefinitionField({ class: "Group" }, "type", "definition.type")).toBe(
			true
		);
		expect(isApplicationAssignedDefinitionField({ class: "View" }, "subType", "definition.subType")).toBe(
			true
		);
		expect(isApplicationAssignedDefinitionField({ class: "Connection" }, "type", "definition.type")).toBe(
			false
		);
		expect(
			isApplicationAssignedDefinitionField({ class: "Asset" }, "type", "definition.tags[0].type")
		).toBe(false);
		expect(
			isApplicationAssignedDefinitionField({ class: "Asset" }, "tag", "definition.tags[0].tag")
		).toBe(false);
	});

	it("wirft wenn Schema fehlt", () => {
		expect(() => resolveAssetDefinitionTypesForCreate("UNKNOWN", undefined)).toThrow(
			/UNKNOWN/
		);
	});
});
