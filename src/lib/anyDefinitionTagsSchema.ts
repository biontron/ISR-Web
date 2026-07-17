/**
 * ANY-DEFINITION: definition.tags muss collectionType "array" mit Feld "tag" sein
 * (MST: ElementDefinitionTag[]). Legacy-Schema mit map/fester Objektgruppe würde
 * definition.tags.tag erzeugen und { tag: "" } an tags[] schreiben.
 */

type SchemaItemSnapshot = {
	kind?: string;
	dataStructure?: { itemName?: string };
	fieldType?: string;
	collectionType?: string;
	minUsage?: number;
	maxUsage?: number;
	items?: SchemaItemSnapshot[];
};

function isFixedMapGroup(group: SchemaItemSnapshot): boolean {
	return (
		group.kind === "group" &&
		group.collectionType === "map" &&
		group.minUsage === 1 &&
		group.maxUsage === 1
	);
}

/** Array-Eintrag: direkt Felder (typisch tag), nicht verschachtelte map-Wrapper. */
function normalizeTagsArrayEntryItems(items: SchemaItemSnapshot[] | undefined): SchemaItemSnapshot[] {
	if (!items?.length) {
		return [];
	}

	if (items.length === 1 && items[0].kind === "group" && isFixedMapGroup(items[0])) {
		return normalizeTagsArrayEntryItems(items[0].items);
	}

	return items.filter((item) => item.kind === "field" || item.kind === "group");
}

const DEFAULT_TAG_FIELD: SchemaItemSnapshot = {
	kind: "field",
	dataStructure: { itemName: "tag" },
	fieldType: "string",
};

function resolveTagsMaxUsage(maxUsage: number | undefined): number {
	return typeof maxUsage === "number" && maxUsage > 0 ? maxUsage : 50;
}

function patchDefinitionTagsGroup(group: SchemaItemSnapshot): SchemaItemSnapshot {
	if (group.dataStructure?.itemName !== "tags" || group.kind !== "group") {
		return group;
	}

	const entryItems = normalizeTagsArrayEntryItems(group.items);
	const normalizedEntryItems = entryItems.length > 0 ? entryItems : [DEFAULT_TAG_FIELD];
	const maxUsage = resolveTagsMaxUsage(group.maxUsage);

	if (group.collectionType === "array") {
		return {
			...group,
			collectionType: "array",
			minUsage: 0,
			maxUsage,
			items: normalizedEntryItems,
		};
	}

	if (group.collectionType !== "map") {
		return group;
	}

	return {
		...group,
		collectionType: "array",
		minUsage: 0,
		maxUsage,
		items: normalizedEntryItems,
	};
}

function patchSchemaItems(items: SchemaItemSnapshot[] | undefined): SchemaItemSnapshot[] | undefined {
	if (!items?.length) {
		return items;
	}

	return items.map((item) => {
		if (item.kind !== "group") {
			return item;
		}

		if (item.dataStructure?.itemName === "definition") {
			return {
				...item,
				items: item.items?.map((child) =>
					child.dataStructure?.itemName === "tags"
						? patchDefinitionTagsGroup(child)
						: child
				),
			};
		}

		return {
			...item,
			items: patchSchemaItems(item.items),
		};
	});
}

export function patchAnyDefinitionSchemaSnapshot<T extends Record<string, unknown>>(schema: T): T {
	if (schema.id !== "ANY-DEFINITION" || !Array.isArray(schema.items)) {
		return schema;
	}

	return {
		...schema,
		items: patchSchemaItems(schema.items as SchemaItemSnapshot[]) as T["items"],
	};
}

export function patchInternalSchemaRestItems(items: unknown[]): unknown[] {
	return items.map((item) => {
		if (item && typeof item === "object" && (item as { id?: string }).id === "ANY-DEFINITION") {
			return patchAnyDefinitionSchemaSnapshot(item as Record<string, unknown>);
		}
		return item;
	});
}
