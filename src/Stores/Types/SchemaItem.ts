/* SchemaItem.ts */
import { Instance, types } from "mobx-state-tree";
import { SchemaFieldModel } from "../Models/SchemaField.Model";
import { SchemaGroupModel } from "../Models/SchemaGroup.Model";

export interface SchemaField {
	order: number;
	dataStructure: {
		itemName: string;
		default: string;
	};
	formProperties: {
		label: string;
	};
	fieldType: string;
	rules: string;
	example: string;
	flags: {};
	minUsage: number;
	maxUsage: number;
}

export interface SchemaGroup {
	order: number;
	dataStructure: {
		itemName: string;
	};
	formProperties: {
		label: string;
	};
	minUsage: number;
	maxUsage: number;
	items: (SchemaField | SchemaGroup)[];
}

export interface SchemaTemplate {
	type: string;
	name: string;
	order: number;
	items: (SchemaField | SchemaGroup)[];
	description: string;
}

// Union von SchemaGroupModel und SchemaFieldModel
// Statt direkt types.union(...) => wrappe es in types.late
export const SchemaItem = types.late(() =>
	types.union(
		{
			dispatcher: (snapshot) => {
				return snapshot.kind === "group" ? SchemaGroupModel : SchemaFieldModel;
			},
		},
		SchemaGroupModel,
		SchemaFieldModel
	)
);
export type ISchemaItem = Instance<typeof SchemaItem>;