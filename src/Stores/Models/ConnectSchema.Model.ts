/*
# SPDX-License-Identifier: GPL-2.0*/

import { Instance, types } from "mobx-state-tree";
import ElementModel from "./Element.Model";
import { MultilingualText } from "../Types/MultilingualText";
import { ConnectSchemaItem } from "../Types/ConnectSchemaItem";
import { ElementKindType, SchemaStoreType } from "../../lib/schemaDomain";

export const ConnectSchemaModel = types.compose(
	ElementModel,
	types.model("ConnectSchemaModel", {
		id: types.identifier,
		storeType: types.enumeration<SchemaStoreType>("SchemaStoreType", [
			"INTERNAL",
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
		items: types.array(types.late(() => ConnectSchemaItem)),
	})
);

export type IConnectSchemaModel = Instance<typeof ConnectSchemaModel>;
