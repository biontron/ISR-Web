/*
# SPDX-License-Identifier: GPL-2.0*/

import { Instance, types } from "mobx-state-tree";
import { ConnectSchemaFieldModel } from "../Models/ConnectSchemaField.Model";
import { ConnectSchemaGroupModel } from "../Models/ConnectSchemaGroup.Model";

export const ConnectSchemaItem = types.late(() =>
	types.union(
		{
			dispatcher: (snapshot) => {
				return snapshot.kind === "group"
					? ConnectSchemaGroupModel
					: ConnectSchemaFieldModel;
			},
		},
		ConnectSchemaGroupModel,
		ConnectSchemaFieldModel
	)
);

export type IConnectSchemaItem = Instance<typeof ConnectSchemaItem>;