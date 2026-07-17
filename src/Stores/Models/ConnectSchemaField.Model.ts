/*
# SPDX-License-Identifier: GPL-2.0*/
// File: src/Stores/Models/ConnectSchemaField.Model.ts

import { Instance, types } from "mobx-state-tree";
import { MultilingualText } from "../Types/MultilingualText";

const ConnectSchemaFieldFlags = types.model({
	readonly: types.optional(types.boolean, false),
	hidden: types.optional(types.boolean, false),
	nullable: types.optional(types.boolean, false),
});

export const ConnectSchemaFieldModel = types.model("ConnectSchemaField", {
	kind: types.literal("field"),
	order: types.number,
	dataStructure: types.model({
		itemName: types.string,
		default: types.maybe(types.string),
		nullable: types.optional(types.boolean, false),
	}),
	formProperties: types.model({
		label: MultilingualText,
	}),
	fieldType: types.enumeration("DataType", [
		"string", "number", "boolean", "null", "object", "array"
	]),
	rules: types.maybe(types.string),
	example: types.maybe(types.string),
	itemFlags: types.optional(ConnectSchemaFieldFlags, () => ({
		readonly: false,
		hidden: false,
		nullable: false,
	})),
	minUsage: types.number,
	maxUsage: types.number,
});

export type IConnectSchemaFieldModel = Instance<typeof ConnectSchemaFieldModel>;