import { getIdentifier } from "mobx-state-tree";
import { IAsset } from "../Stores/Models/Asset.Model";
import { IGroup } from "../Stores/Models/Group.Model";
import { IRootStore } from "../Stores/Root.Store";
import { assetMatchesAnyFilterRule } from "./filterRulesMatch";
import { resolveTreeNodeSegment } from "./treeNodeDisplay";

export type LinkedChildElement = IGroup | IAsset;

export function resolveElementRefId(ref: { id: unknown }): string | undefined {
	if (typeof ref.id === "string" && ref.id.trim() !== "") {
		return ref.id.trim();
	}
	if (ref.id) {
		return getIdentifier(ref.id as IAsset) ?? undefined;
	}
	return undefined;
}

/** MST-Arrays und normale Arrays auf eine einfache Ref-Liste bringen. */
export function toPlainElementIdRefs(refs: unknown): Array<{ id: unknown }> {
	if (refs == null) {
		return [];
	}
	return Array.prototype.slice.call(refs) as Array<{ id: unknown }>;
}

type ElementLikeForViewGroup = {
	class?: string;
	definition?: unknown;
} | null | undefined;

function readDefinitionStoreType(definition: unknown): string | undefined {
	if (!definition || typeof definition !== "object") {
		return undefined;
	}
	const storeType = (definition as { storeType?: unknown }).storeType;
	return typeof storeType === "string" ? storeType : undefined;
}

/** Logische View-Gruppe: XPath/filterRules und Child-Refs sind zulässig. */
export function isLogicalViewGroupElement(element: ElementLikeForViewGroup): boolean {
	if (!element) {
		return false;
	}
	const storeType = readDefinitionStoreType(element.definition);
	return resolveTreeNodeSegment({ storeType }, element.class) === "viewGroup";
}

function resolveElementById(
	root: IRootStore,
	id: string
): LinkedChildElement | undefined {
	const asset = root.assets.assets.find((item: IAsset) => item.id === id);
	if (asset) {
		return asset;
	}
	return root.groups.groups.find((item: IGroup) => item.id === id);
}

function addUnique(
	byId: Map<string, LinkedChildElement>,
	element: LinkedChildElement | undefined
) {
	if (element && !byId.has(element.id)) {
		byId.set(element.id, element);
	}
}

/**
 * Alle Kind-Elemente eines Parents: Parent-Ref (parentIdRef / ownerIdRef),
 * Child-Ref (elementIdRefs) und — bei View-Gruppen — XPath/filterRules.
 */
export function collectAssignedChildElements(
	root: IRootStore,
	parent: {
		id: string;
		class?: string;
		definition?: unknown;
		elementIdRefs?: Array<{ id: unknown }>;
		filterRules?: unknown[];
	}
): LinkedChildElement[] {
	const byId = new Map<string, LinkedChildElement>();
	const parentId = parent.id;

	for (const group of root.groups.groups) {
		if (group.parentIdRef === parentId) {
			addUnique(byId, group);
		}
	}

	for (const asset of root.assets.assets) {
		if (asset.ownerIdRef === parentId) {
			addUnique(byId, asset);
		}
	}

	for (const ref of parent.elementIdRefs ?? []) {
		const refId = resolveElementRefId(ref);
		if (refId) {
			addUnique(byId, resolveElementById(root, refId));
		}
	}

	if (isLogicalViewGroupElement(parent)) {
		for (const asset of root.assets.assets) {
			if (assetMatchesAnyFilterRule(asset, parent.filterRules)) {
				addUnique(byId, asset);
			}
		}
	}

	return Array.from(byId.values());
}

export function collectAvailableChildElements(
	root: IRootStore,
	parentId: string,
	assignedIds: Set<string>
): LinkedChildElement[] {
	const available: LinkedChildElement[] = [];

	for (const group of root.groups.groups) {
		if (group.id === parentId || assignedIds.has(group.id)) {
			continue;
		}
		if (group.parentIdRef === undefined || group.parentIdRef === "") {
			available.push(group);
		}
	}

	for (const asset of root.assets.assets) {
		if (asset.id === parentId || assignedIds.has(asset.id)) {
			continue;
		}
		if (asset.ownerIdRef == null || asset.ownerIdRef === "") {
			available.push(asset);
		}
	}

	return available;
}
