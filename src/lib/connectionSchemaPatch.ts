/**
 * CONNECTION-Schema: MST/REST-Feldnamen (fromComponentRef, *LabelSnapshot)
 * statt Legacy fromAssetRef / fromLabel / toLabel.
 * Wrapper um flache links[n] / linkparts[n] werden aufgelöst — REST bleibt unverändert.
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

const LINK_NESTED_GROUP_NAMES = new Set(["linkparts", "credentials", "metadata"]);

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

const CREDENTIALS_GROUP_TEMPLATE: SchemaItemSnapshot = {
	kind: "group",
	order: 12,
	dataStructure: { itemName: "credentials" },
	formProperties: { label: { und: "Credentials", de: "Zugangsdaten" } },
	itemFlags: { readonly: false, hidden: false },
	minUsage: 0,
	maxUsage: 20,
	collectionType: "array",
	items: [],
};

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

function isArrayGroup(item: SchemaItemSnapshot): boolean {
	return item.kind === "group" && item.collectionType === "array";
}

function isFlatWrapperGroup(item: SchemaItemSnapshot, nestedNames: Set<string>): boolean {
	if (item.kind !== "group" || isArrayGroup(item)) {
		return false;
	}
	const itemName = item.dataStructure?.itemName?.trim() ?? "";
	if (nestedNames.has(itemName)) {
		return false;
	}
	const maxUsage = item.maxUsage ?? 1;
	return maxUsage === 1;
}

function dedupeSchemaItems(items: SchemaItemSnapshot[]): SchemaItemSnapshot[] {
	const seen = new Set<string>();
	const result: SchemaItemSnapshot[] = [];
	for (const item of items) {
		const itemName = item.dataStructure?.itemName?.trim() ?? "";
		if (itemName) {
			if (seen.has(itemName)) {
				continue;
			}
			seen.add(itemName);
		}
		result.push(item);
	}
	return result;
}

function hoistFlatWrappers(
	items: SchemaItemSnapshot[] | undefined,
	nestedNames: Set<string>
): SchemaItemSnapshot[] {
	const hoisted: SchemaItemSnapshot[] = [];
	for (const item of items ?? []) {
		if (isFlatWrapperGroup(item, nestedNames)) {
			hoisted.push(...hoistFlatWrappers(item.items, nestedNames));
			continue;
		}
		hoisted.push(item);
	}
	return dedupeSchemaItems(hoisted);
}

function ensureNamedGroup(
	items: SchemaItemSnapshot[],
	itemName: string,
	template: SchemaItemSnapshot
): SchemaItemSnapshot[] {
	if (items.some((entry) => entry.dataStructure?.itemName === itemName)) {
		return items;
	}
	return [...items, template];
}

function ensureLinkpartsLabelFields(items: SchemaItemSnapshot[]): SchemaItemSnapshot[] {
	const renamed = items.map(renameConnectionSchemaField);
	const hasFrom = renamed.some((entry) => entry.dataStructure?.itemName === "fromLabelSnapshot");
	const hasTo = renamed.some((entry) => entry.dataStructure?.itemName === "toLabelSnapshot");
	if (hasFrom && hasTo) {
		return renamed;
	}

	const injected = [...renamed];
	if (!hasFrom) {
		injected.unshift(LINKPART_LABEL_FIELD_TEMPLATES[0]);
	}
	if (!hasTo) {
		const insertAt = injected.findIndex(
			(entry) => entry.dataStructure?.itemName === "fromLabelSnapshot"
		);
		injected.splice(insertAt + 1, 0, LINKPART_LABEL_FIELD_TEMPLATES[1]);
	}
	return injected;
}

function patchConnectionSchemaItems(
	items: SchemaItemSnapshot[] | undefined,
	parentGroupName = ""
): SchemaItemSnapshot[] | undefined {
	if (!items?.length && parentGroupName !== "links") {
		return items;
	}

	const patched = (items ?? []).map((item) => {
		if (item.kind !== "group") {
			return renameConnectionSchemaField(item);
		}

		const itemName = item.dataStructure?.itemName ?? "";
		const childParent = itemName === "links" || itemName === "linkparts" ? itemName : "";
		return {
			...item,
			items: patchConnectionSchemaItems(item.items, childParent),
		};
	});

	if (parentGroupName === "linkparts") {
		return ensureLinkpartsLabelFields(hoistFlatWrappers(patched, new Set()));
	}

	if (parentGroupName === "links") {
		return ensureNamedGroup(
			hoistFlatWrappers(patched, LINK_NESTED_GROUP_NAMES),
			"credentials",
			CREDENTIALS_GROUP_TEMPLATE
		);
	}

	return patched;
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
