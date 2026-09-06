/*
# SPDX-License-Identifier: GPL-2.0*/

/* Schema.Model.ts */
import { Instance, types } from "mobx-state-tree";
import { SchemaItem } from "../Types/SchemaItem";
import { MultilingualText } from "../Types/MultilingualText";
import ElementModel from "./Element.Model";
import { ElementKindType, SchemaStoreType } from "../../lib/schemaDomain";

/**
 * A schema model (XSD: id, storeType, basetype, type, subtype, …)
 */
export const SchemaModel = types.compose(
	ElementModel,
	types
		.model("SchemaModel", {
			id: types.identifier,
			storeType: types.enumeration<SchemaStoreType>("SchemaStoreType", [
				"INTERNAL",
				"VIEWGROUP",
				"COMPONENT",
				"DOCKPART",
			]),
			baseType: types.enumeration<ElementKindType>("ElementKindType", [
				"GROUP",
				"VIEWGROUP",
				"COMPONENT",
				"CONNECTION",
				"TEMPLATE",
			]),
			type: types.string,
			subType: types.optional(types.string, ""),
			name: MultilingualText,
			description: MultilingualText,
			order: types.number,
			parent: types.model({
				whitelist: types.array(types.string),
				blacklist: types.array(types.string),
			}),
			style: types.model({
				treeIcon: types.string,
			}),
			items: types.array(types.late(() => SchemaItem)),
		})
		.actions((self) => ({}))
);

export type ISchemaModel = Instance<typeof SchemaModel>;
