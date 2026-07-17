import { Instance, types } from "mobx-state-tree";

import { MultilingualText } from "../Types/MultilingualText";

/**
 * Definition für Field-Flags
 */
const SchemaFieldFlags = types.model({
	readonly: types.optional(types.boolean, false),
	hidden: types.optional(types.boolean, false),
	nullable: types.optional(types.boolean, false),
	// please note: optional wird ueber minUsage = 0 abgebildet
});

/**
 * A single item (as part of the schema model)
 */
export const SchemaFieldModel = types.model("SchemaField", {
	kind: types.literal("field"),
	order: types.number,
	dataStructure: types.model({
		/**
		 * Field name / field identifier ("part of path")
		 */
		itemName: types.string, // the field name (part of path)
		default: types.maybe(types.string), // defaultValue
		nullable: types.optional(types.boolean, false), // can be null
	}),

	formProperties: types.model({
		/**
		 * Translations for the field label
		 */
		label: MultilingualText,
	}),

	fieldType: types.enumeration("DataType", [
		"string",
		"number",
		"boolean",
		"null",
		"object",
		"array",
	]), // dataType
	// logicalType: types.enumeration("LogicalType", ["text", "number", "timestamp",  "date", "time", "username", "ip-address", "email", "url"]),
	rules: types.maybe(types.string), // formPattern

	example: types.maybe(types.string), // formPlaceholder
	itemFlags: SchemaFieldFlags, // itemFlags
	minUsage: types.number, // usage of the field (number of occurences)
	maxUsage: types.number,
});

export type ISchemaFieldModel = Instance<typeof SchemaFieldModel>;
