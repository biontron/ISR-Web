/*
# SPDX-License-Identifier: GPL-2.0*/
// File: src/Stores/Models/ConnectSchemaGroup.Model.ts

import { Instance, types } from "mobx-state-tree";
import { MultilingualText } from "../Types/MultilingualText";
import { ConnectSchemaItem } from "../Types/ConnectSchemaItem";

const ConnectSchemaGroupFlags = types.model({
	readonly: types.optional(types.boolean, false),
	hidden: types.optional(types.boolean, false),
});

export const ConnectSchemaGroupModel = types.model("ConnectSchemaGroup", {
	kind: types.literal("group"),
	order: types.number,
	dataStructure: types.model({
		itemName: types.string,
	}),
	formProperties: types.model({
		label: MultilingualText,
	}),
	itemFlags: types.optional(ConnectSchemaGroupFlags, () => ({
		readonly: false,
		hidden: false,
	})),
	minUsage: types.number,
	maxUsage: types.number,
	collectionType: types.maybeNull(types.enumeration("CollectionType", ["array", "map"])),

	// Wichtig: Explizites 'any' im late-Callback, um den Zirkelbezug aufzulösen
	items: types.array(types.late((): any => ConnectSchemaItem)),
});

export type IConnectSchemaGroupModel = Instance<typeof ConnectSchemaGroupModel>;