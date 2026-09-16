import { IAsset } from "../Stores/Models/Asset.Model";
import { IGroup } from "../Stores/Models/Group.Model";
import { IRootStore } from "../Stores/Root.Store";
import {
	assignAssetToParentRefs,
	assignElementToParent,
	collectAvailableMappingElements,
	isAssignedToParent,
	type AssignableTreeElement,
	type AssignmentParent,
} from "./elementAssignments";
import { readEnvironmentId } from "./environmentIdentity";
import { elementMatchesAnyXPath, elementMatchesXPath } from "./elementXPathFilter";
import { elementMatchesFreetext, resolveSearchMode } from "./elementXPathValidation";
import { filterRuleActivated, normalizeFilterRules, type FilterRuleRecord } from "./filterRuleNormalize";
import {
	collectLinkedAssetIdsForView,
	collectViewGroupsUnderView,
} from "./treeUnlinkedAssets";

export type MappingCandidateFilter = {
	searchText?: string;
	environmentIds?: string[] | null;
	rules?: unknown[];
};

export function activatedFilterRules(rules: unknown[] | undefined): FilterRuleRecord[] {
	return normalizeFilterRules(rules ?? []).filter((rule) => rule.activated && rule.xpath !== "");
}

export function filterMappingCandidates(
	elements: AssignableTreeElement[],
	options: MappingCandidateFilter
): AssignableTreeElement[] {
	const search = options.searchText?.trim() ?? "";
	const envIds = options.environmentIds;
	const rules = (options.rules ?? []).filter(
		(rule) => filterRuleActivated(rule) && Boolean(normalizeFilterRules([rule])[0]?.xpath)
	);
	const searchMode = search ? resolveSearchMode(search) : null;

	return elements.filter((element) => {
		if (element.class === "Asset" && envIds) {
			const environmentId = readEnvironmentId(element as IAsset);
			if (envIds.length === 0 || !environmentId || !envIds.includes(environmentId)) {
				return false;
			}
		}
		if (rules.length > 0 && !elementMatchesAnyXPath(element, rules)) {
			return false;
		}
		if (!search || !searchMode) {
			return true;
		}
		if (searchMode === "xpath") {
			return elementMatchesXPath(element, search);
		}
		return elementMatchesFreetext(element, search);
	});
}

export function collectFilteredMappingCandidates(
	root: Pick<IRootStore, "groups" | "assets">,
	parentId: string,
	options: MappingCandidateFilter & {
		unlinkedOnly?: boolean;
		viewLinkedAssetIds?: Set<string>;
		viewLinkedGroupIds?: Set<string>;
	}
): AssignableTreeElement[] {
	const available = collectAvailableMappingElements(root, parentId, {
		unlinkedOnly: options.unlinkedOnly,
		viewLinkedAssetIds: options.viewLinkedAssetIds,
		viewLinkedGroupIds: options.viewLinkedGroupIds,
	});
	return filterMappingCandidates(available, options);
}

export function applyAutomappingToParent(
	root: Pick<IRootStore, "groups" | "assets">,
	parent: AssignmentParent,
	options?: {
		environmentIds?: string[] | null;
		unlinkedOnly?: boolean;
		viewLinkedAssetIds?: Set<string>;
		viewLinkedGroupIds?: Set<string>;
	}
): { added: number } {
	const activated = activatedFilterRules(
		(parent as { filterRules?: unknown[] }).filterRules
	);
	if (activated.length === 0) {
		return { added: 0 };
	}

	const matched = collectFilteredMappingCandidates(root, parent.id, {
		environmentIds: options?.environmentIds,
		rules: activated,
		unlinkedOnly: options?.unlinkedOnly,
		viewLinkedAssetIds: options?.viewLinkedAssetIds,
		viewLinkedGroupIds: options?.viewLinkedGroupIds,
	});

	let added = 0;
	for (const child of matched) {
		if (child.class !== "Asset") {
			continue;
		}
		if (parent.class === "Group" && typeof parent.setElementIdRefs === "function") {
			if (assignAssetToParentRefs(parent, child as IAsset)) {
				added += 1;
			}
			continue;
		}
		if (!isAssignedToParent(child, parent.id)) {
			assignElementToParent(child, parent.id);
			added += 1;
		}
	}
	return { added };
}

export function applyAutomappingToViewGroups(
	root: IRootStore,
	viewId: string | undefined,
	options?: { environmentIds?: string[] | null; unlinkedOnly?: boolean }
): { added: number; groups: number } {
	if (!viewId) {
		return { added: 0, groups: 0 };
	}
	const viewGroups = collectViewGroupsUnderView(root, viewId);
	const viewLinkedAssetIds =
		options?.unlinkedOnly === false ? undefined : collectLinkedAssetIdsForView(root, viewId);
	const viewLinkedGroupIds =
		options?.unlinkedOnly === false
			? undefined
			: new Set(viewGroups.map((group) => group.id));

	let added = 0;
	let groups = 0;
	for (const group of viewGroups) {
		if (activatedFilterRules(group.filterRules).length === 0) {
			continue;
		}
		const result = applyAutomappingToParent(root, group, {
			environmentIds: options?.environmentIds,
			unlinkedOnly: options?.unlinkedOnly !== false,
			viewLinkedAssetIds,
			viewLinkedGroupIds,
		});
		if (result.added > 0) {
			added += result.added;
			groups += 1;
			if (viewLinkedAssetIds) {
				for (const ref of group.elementIdRefs ?? []) {
					const id = typeof ref.id === "string" ? ref.id : "";
					if (id) {
						viewLinkedAssetIds.add(id);
					}
				}
			}
		}
	}
	return { added, groups };
}

export function viewGroupsHaveActivatedFilterRules(root: IRootStore, viewId: string | undefined): boolean {
	if (!viewId) {
		return false;
	}
	return collectViewGroupsUnderView(root, viewId).some(
		(group: IGroup) => activatedFilterRules(group.filterRules).length > 0
	);
}
