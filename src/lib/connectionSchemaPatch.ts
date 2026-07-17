/**
 * CONNECTION-Schema: MST/REST-Feldnamen (fromComponentRef, *LabelSnapshot)
 * statt Legacy fromAssetRef / fromLabel / toLabel.
 */

type SchemaItemSnapshot = {
	kind?: string;
	order?: number;
	dataStructure?: { itemName?: string; default?: unknown };
	formProperties?: { label?: { und?: string; de?: string } };
	fieldType?: string;
	rules?: string;
	itemFlags?: Record<string, unknown>;
	minUsage?: number;
	maxUsage?: number;
	collectionType?: string;
	items?: SchemaItemSnapshot[];
};

const CONNECTION_FIELD_RENAMES: Record<string, string> = {
	fromAssetRef: "fromComponentRef",
	toAssetRef: "toComponentRef",
	fromLabel: "fromLabelSnapshot",
	toLabel: "toLabelSnapshot",
};

const LINKPART_LABEL_FIELD_TEMPLATES: SchemaItemSnapshot[] = [
	{
		kind: "field",
		order: 1,
		dataStructure: { itemName: "fromLabelSnapshot", default: "" },
		formProperties: { label: { und: "From label snapshot", de: "Von-Label-Snapshot" } },
		fieldType: "string",
		rules: "[\\x20-\\x7E]{0,100}",
		itemFlags: { readonly: false, hidden: false, nullable: true },
		minUsage: 0,
		maxUsage: 1,
	},
	{
		kind: "field",
		order: 2,
		dataStructure: { itemName: "toLabelSnapshot", default: "" },
		formProperties: { label: { und: "To label snapshot", de: "Nach-Label-Snapshot" } },
		fieldType: "string",
		rules: "[\\x20-\\x7E]{0,100}",
		itemFlags: { readonly: false, hidden: false, nullable: true },
		minUsage: 0,
		maxUsage: 1,
	},
];

function renameConnectionSchemaField(item: SchemaItemSnapshot): SchemaItemSnapshot {
	if (item.kind !== "field") {
		return item;
	}
	const itemName = item.dataStructure?.itemName;
	if (!itemName) {
		return item;
	}
	const renamed = CONNECTION_FIELD_RENAMES[itemName];
	if (!renamed) {
		return item;
	}
	return {
		...item,
		dataStructure: {
			...item.dataStructure,
			itemName: renamed,
		},
	};
}

function ensureLinkpartsLabelFields(group: SchemaItemSnapshot): SchemaItemSnapshot {
	if (group.dataStructure?.itemName !== "linkparts" || group.kind !== "group") {
		return group;
	}
	const items = (group.items ?? []).map(renameConnectionSchemaField);
	const hasFrom = items.some((entry) => entry.dataStructure?.itemName === "fromLabelSnapshot");
	const hasTo = items.some((entry) => entry.dataStructure?.itemName === "toLabelSnapshot");
	if (hasFrom && hasTo) {
		return { ...group, items };
	}

	const injected: SchemaItemSnapshot[] = [...items];
	if (!hasFrom) {
		injected.unshift(LINKPART_LABEL_FIELD_TEMPLATES[0]);
	}
	if (!hasTo) {
		const insertAt = injected.findIndex(
			(entry) => entry.dataStructure?.itemName === "fromLabelSnapshot"
		);
		injected.splice(insertAt + 1, 0, LINKPART_LABEL_FIELD_TEMPLATES[1]);
	}

	return { ...group, items: injected };
}

function patchConnectionSchemaItems(items: SchemaItemSnapshot[] | undefined): SchemaItemSnapshot[] | undefined {
	if (!items?.length) {
		return items;
	}

	return items.map((item) => {
		if (item.kind !== "group") {
			return renameConnectionSchemaField(item);
		}

		if (item.dataStructure?.itemName === "linkparts") {
			return ensureLinkpartsLabelFields(item);
		}

		return {
			...item,
			items: patchConnectionSchemaItems(item.items),
		};
	});
}

export function patchConnectionSchemaSnapshot<T extends Record<string, unknown>>(schema: T): T {
	if (schema.id !== "CONNECTION" || !Array.isArray(schema.items)) {
		return schema;
	}

	return {
		...schema,
		items: patchConnectionSchemaItems(schema.items as SchemaItemSnapshot[]) as T["items"],
	};
}

export function patchConnectionSchemaRestItems(items: unknown[]): unknown[] {
	return items.map((item) => {
		if (item && typeof item === "object" && (item as { id?: string }).id === "CONNECTION") {
			return patchConnectionSchemaSnapshot(item as Record<string, unknown>);
		}
		return item;
	});
}
