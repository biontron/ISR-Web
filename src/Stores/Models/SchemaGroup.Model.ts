/* SchemaGroup.Model.ts */
import { Instance, types } from "mobx-state-tree";
import { MultilingualText } from "../Types/MultilingualText";
import { SchemaItem } from "../Types/SchemaItem"; // Hier kommt die Union her

const SchemaGroupFlags = types.model({
	readonly: types.optional(types.boolean, false),
	hidden: types.optional(types.boolean, false),
});

export const SchemaGroupModel = types.model("SchemaGroup", {
	kind: types.literal("group"),
	order: types.number,
	dataStructure: types.model({
		itemName: types.string,
	}),
	formProperties: types.model({
		label: MultilingualText,
	}),
	itemFlags: types.optional(SchemaGroupFlags, () => ({
		readonly: false,
		hidden: false,
	})),
	minUsage: types.number,
	maxUsage: types.number,
	collectionType: types.enumeration("CollectionType", ["array", "map"]),


	// Hier ebenfalls types.late,
	// damit wir später "SchemaItem" referenzieren können,
	// ohne dass TS meckert
	items: types.array(
		types.late(() => {
			// Hier greifen wir auf die *fertige* SchemaItem-Konstante zu
			const { SchemaItem } = require("../Types/SchemaItem");
			return SchemaItem;
		})
	),
});

export type ISchemaGroupModel = Instance<typeof SchemaGroupModel>;

