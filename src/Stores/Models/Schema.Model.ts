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
		.preProcessSnapshot((snapshot: any) => {
			// Backward compatibility for mistakenly persisted schema items:
			// baseType must remain an ElementKindType, never a storeType.
			if (snapshot && snapshot.baseType === "VIEWGROUP") {
				return {
					...snapshot,
					baseType: "GROUP",
				};
			}
			return snapshot;
		})
		.actions((self) => ({}))
);

export type ISchemaModel = Instance<typeof SchemaModel>;
