import { IAsset } from "../Stores/Models/Asset.Model";
import { IGroup } from "../Stores/Models/Group.Model";
import { IRootStore } from "../Stores/Root.Store";
import { readEnvironmentId } from "./environmentIdentity";
import { filterRuleExpression, toFilterRuleRecord } from "./filterRuleNormalize";

export type AssignableTreeElement = IGroup | IAsset;

export type ElementIdRef = {
	environmentId: string;
	id: string;
	baseType: string;
	type: string;
	subType: string;
	name: string;
	label: string;
};

export type ElementIdRefSource = Pick<IAsset, "id"> & {
	environmentId?: string | null;
	definition?: {
		baseType?: string;
		type?: string;
		subType?: string;
		name?: string;
		label?: string;
	};
};

export type XPathFilterRule = {
	environments?: Array<{ ref: string }>;
	xpath: string;
	description: string;
	activated?: boolean;
};

function isNonEmptyId(value: unknown): value is string {
	return typeof value === "string" && value.trim() !== "";
}

export function readGroupParentId(group: Pick<IGroup, "parentIdRef">): string | undefined {
	return isNonEmptyId(group.parentIdRef) ? group.parentIdRef.trim() : undefined;
}

export function readAssetOwnerId(asset: Pick<IAsset, "ownerIdRef">): string | undefined {
	return isNonEmptyId(asset.ownerIdRef) ? String(asset.ownerIdRef).trim() : undefined;
}

export function isAssignedToParent(
	element: AssignableTreeElement,
	parentId: string
): boolean {
	if (element.class === "Group") {
		return readGroupParentId(element as IGroup) === parentId;
	}
	return readAssetOwnerId(element as IAsset) === parentId;
}

export function isStaticallyUnassigned(element: AssignableTreeElement): boolean {
	if (element.class === "Group") {
		return readGroupParentId(element as IGroup) === undefined;
	}
	return readAssetOwnerId(element as IAsset) === undefined;
}

export type AssignmentParent = {
	id: string;
	class?: string;
	filterRules?: unknown[];
	elementIdRefs?: Array<Partial<ElementIdRef> & { id?: unknown }>;
	setElementIdRefs?: (refs: ElementIdRef[]) => void;
};

function readRefString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

export function readElementIdRef(ref: Partial<ElementIdRef> & { id?: unknown }): ElementIdRef | undefined {
	const id = isNonEmptyId(ref.id) ? ref.id.trim() : "";
	if (!id) {
		return undefined;
	}
	return {
		environmentId: readRefString(ref.environmentId),
		id,
		baseType: readRefString(ref.baseType),
		type: readRefString(ref.type),
		subType: readRefString(ref.subType),
		name: readRefString(ref.name),
		label: readRefString(ref.label),
	};
}

export function toAssetElementIdRef(asset: ElementIdRefSource): ElementIdRef {
	const definition = asset.definition ?? {};
	return {
		environmentId: readEnvironmentId(asset),
		id: asset.id,
		baseType: typeof definition.baseType === "string" ? definition.baseType : "",
		type: typeof definition.type === "string" ? definition.type : "",
		subType: typeof definition.subType === "string" ? definition.subType : "",
		name: typeof definition.name === "string" ? definition.name : "",
		label: typeof definition.label === "string" ? definition.label : "",
	};
}

export function elementIdRefsEqual(left: ElementIdRef, right: ElementIdRef): boolean {
	return left.id === right.id && left.environmentId === right.environmentId;
}

export function snapshotElementIdRefs(
	refs: Array<Partial<ElementIdRef> & { id?: unknown }> | undefined
): ElementIdRef[] {
	const next: ElementIdRef[] = [];
	for (const ref of refs ?? []) {
		const parsed = readElementIdRef(ref);
		if (parsed) {
			next.push(parsed);
		}
	}
	return next;
}

export function hasAssetElementIdRef(
	refs: Array<Partial<ElementIdRef> & { id?: unknown }> | undefined,
	asset: ElementIdRefSource
): boolean {
	const target = toAssetElementIdRef(asset);
	return snapshotElementIdRefs(refs).some((entry) => elementIdRefsEqual(entry, target));
}

export function addAssetElementIdRef(
	refs: Array<Partial<ElementIdRef> & { id?: unknown }> | undefined,
	asset: ElementIdRefSource
): ElementIdRef[] {
	const current = snapshotElementIdRefs(refs);
	const entry = toAssetElementIdRef(asset);
	if (current.some((item) => elementIdRefsEqual(item, entry))) {
		return current;
	}
	return [...current, entry];
}

export function removeAssetElementIdRef(
	refs: Array<Partial<ElementIdRef> & { id?: unknown }> | undefined,
	asset: ElementIdRefSource
): ElementIdRef[] {
	const target = toAssetElementIdRef(asset);
	return snapshotElementIdRefs(refs).filter((entry) => {
		if (entry.id !== target.id) {
			return true;
		}
		if (
			target.environmentId &&
			entry.environmentId &&
			entry.environmentId !== target.environmentId
		) {
			return true;
		}
		return false;
	});
}

export function assignmentKey(element: AssignableTreeElement): string {
	if (element.class === "Asset") {
		const environmentId = readEnvironmentId(element as IAsset);
		return environmentId ? `${element.id}::${environmentId}` : element.id;
	}
	return element.id;
}

export function assignAssetToParentRefs(parent: AssignmentParent, asset: ElementIdRefSource): boolean {
	if (typeof parent.setElementIdRefs !== "function") {
		return false;
	}
	const current = snapshotElementIdRefs(parent.elementIdRefs);
	const next = addAssetElementIdRef(current, asset);
	if (next.length === current.length) {
		return false;
	}
	parent.setElementIdRefs(next);
	return true;
}

export function assignMappedElement(
	child: AssignableTreeElement,
	parent: AssignmentParent
): void {
	if (child.class === "Group") {
		assignElementToParent(child, parent.id);
		return;
	}
	if (parent.class === "Group" && typeof parent.setElementIdRefs === "function") {
		assignAssetToParentRefs(parent, child as IAsset);
		return;
	}
	assignElementToParent(child, parent.id);
}

export function assignElementToParent(child: AssignableTreeElement, parentId: string): void {
	if (child.class === "Group") {
		(child as IGroup).setParentIdRef(parentId);
		return;
	}
	(child as IAsset).setOwnerIdRef(parentId);
}

/** Parent-Ref lösen und Child-Ref (elementIdRefs) am aktuellen Parent entfernen. */
export function unassignElementFromParent(
	child: AssignableTreeElement,
	parent: AssignmentParent
): void {
	if (isAssignedToParent(child, parent.id)) {
		if (child.class === "Group") {
			(child as IGroup).setParentIdRef(undefined);
		} else {
			(child as IAsset).setOwnerIdRef(null);
		}
	}

	const refs = parent.elementIdRefs;
	if (!refs || typeof parent.setElementIdRefs !== "function") {
		return;
	}

	const current = snapshotElementIdRefs(refs);
	const next =
		child.class === "Asset"
			? removeAssetElementIdRef(current, child as IAsset)
			: current.filter((entry) => entry.id !== child.id);

	if (next.length === current.length) {
		return;
	}

	parent.setElementIdRefs(next);
}

function walkAssetOwnerChain(
	startId: string,
	assets: ReadonlyArray<Pick<IAsset, "id" | "ownerIdRef">>
): Set<string> {
	const seen = new Set<string>();
	let currentId: string | undefined = startId;

	while (currentId && !seen.has(currentId)) {
		seen.add(currentId);
		const current = assets.find((asset) => asset.id === currentId);
		currentId = current ? readAssetOwnerId(current as IAsset) : undefined;
	}

	return seen;
}

function walkGroupParentChain(
	startId: string,
	groups: ReadonlyArray<Pick<IGroup, "id" | "parentIdRef">>
): Set<string> {
	const seen = new Set<string>();
	let currentId: string | undefined = startId;

	while (currentId && !seen.has(currentId)) {
		seen.add(currentId);
		const current = groups.find((group) => group.id === currentId);
		currentId = current ? readGroupParentId(current as IGroup) : undefined;
	}

	return seen;
}

export function wouldCreateAssignmentCycle(
	element: AssignableTreeElement,
	parentId: string,
	root: Pick<IRootStore, "groups" | "assets">
): boolean {
	if (element.id === parentId) {
		return true;
	}

	if (element.class === "Group") {
		return walkGroupParentChain(parentId, root.groups.groups).has(element.id);
	}

	return walkAssetOwnerChain(parentId, root.assets.assets).has(element.id);
}

function findGroupParent(
	root: Pick<IRootStore, "groups">,
	parentId: string
): { id: string; elementIdRefs?: Array<Partial<ElementIdRef> & { id?: unknown }> } | undefined {
	return root.groups.groups.find((group) => group.id === parentId);
}

export function collectAssignedElements(
	root: Pick<IRootStore, "groups" | "assets">,
	parentId: string
): AssignableTreeElement[] {
	const groups = root.groups.groups.filter((group) => isAssignedToParent(group, parentId));
	const ownedAssets = root.assets.assets.filter((asset) => isAssignedToParent(asset, parentId));
	const seen = new Set(ownedAssets.map((asset) => assignmentKey(asset as AssignableTreeElement)));
	const assetsById = new Map<string, IAsset[]>();
	for (const asset of root.assets.assets) {
		const bucket = assetsById.get(asset.id);
		if (bucket) {
			bucket.push(asset as IAsset);
		} else {
			assetsById.set(asset.id, [asset as IAsset]);
		}
	}
	const referenced: IAsset[] = [];
	const parentGroup = findGroupParent(root, parentId);
	for (const ref of snapshotElementIdRefs(parentGroup?.elementIdRefs)) {
		const matches = assetsById.get(ref.id);
		if (!matches?.length) {
			continue;
		}
		const asset = !ref.environmentId
			? matches[0]
			: matches.find((item) => readEnvironmentId(item) === ref.environmentId) ?? matches[0];
		const key = assignmentKey(asset as AssignableTreeElement);
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		referenced.push(asset);
	}
	return [...groups, ...ownedAssets, ...referenced];
}

export function collectUnassignedElements(
	root: Pick<IRootStore, "groups" | "assets">,
	parentId: string
): AssignableTreeElement[] {
	const groups = root.groups.groups.filter(
		(group) => group.id !== parentId && isStaticallyUnassigned(group)
	);
	const parentIsAsset = root.assets.assets.some((asset) => asset.id === parentId);
	const blockedAssetIds = parentIsAsset
		? walkAssetOwnerChain(parentId, root.assets.assets)
		: null;
	const assignedKeys = new Set(
		collectAssignedElements(root, parentId).map((item) => assignmentKey(item))
	);
	const assets = root.assets.assets.filter((asset) => {
		if (asset.id === parentId || assignedKeys.has(assignmentKey(asset))) {
			return false;
		}
		if (!isStaticallyUnassigned(asset)) {
			return false;
		}
		return !blockedAssetIds || !blockedAssetIds.has(asset.id);
	});
	return [...groups.filter((group) => !assignedKeys.has(group.id)), ...assets];
}

export function collectAvailableMappingElements(
	root: Pick<IRootStore, "groups" | "assets">,
	parentId: string,
	options?: {
		unlinkedOnly?: boolean;
		viewLinkedAssetIds?: Set<string>;
		viewLinkedGroupIds?: Set<string>;
	}
): AssignableTreeElement[] {
	if (options?.unlinkedOnly) {
		return collectUnassignedElements(root, parentId).filter((element) => {
			if (element.class === "Asset" && options.viewLinkedAssetIds?.has(element.id)) {
				return false;
			}
			if (element.class === "Group" && options.viewLinkedGroupIds?.has(element.id)) {
				return false;
			}
			return true;
		});
	}

	const assignedKeys = new Set(
		collectAssignedElements(root, parentId).map((item) => assignmentKey(item))
	);
	const groups = root.groups.groups.filter((group) => {
		if (group.id === parentId || assignedKeys.has(group.id)) {
			return false;
		}
		return !wouldCreateAssignmentCycle(group, parentId, root);
	});
	const assets = root.assets.assets.filter((asset) => {
		if (asset.id === parentId || assignedKeys.has(assignmentKey(asset))) {
			return false;
		}
		return !wouldCreateAssignmentCycle(asset, parentId, root);
	});
	return [...groups, ...assets];
}

export function readXPathExpression(rule: unknown): string {
	return filterRuleExpression(rule);
}

export function toXPathFilterRule(expression: string, description = ""): XPathFilterRule {
	return toFilterRuleRecord(expression, description);
}

export function addXPathFilterRule(
	rules: unknown[],
	expression: string,
	description = "",
	environments?: Array<{ ref: string }>,
	activated = true
): unknown[] {
	const xpath = expression.trim();
	if (!xpath) {
		return rules;
	}
	if (rules.some((rule) => readXPathExpression(rule) === xpath)) {
		return rules;
	}
	return [
		...rules,
		toFilterRuleRecord({
			environments: environments ?? [],
			xpath,
			description: description.trim(),
			activated,
		}),
	];
}

export function updateXPathFilterRule(
	rules: unknown[],
	index: number,
	patch: {
		xpath?: string;
		description?: string;
		environments?: Array<{ ref: string }>;
		activated?: boolean;
	}
): unknown[] {
	if (index < 0 || index >= rules.length) {
		return rules;
	}
	return rules.map((rule, ruleIndex) => {
		const current = toFilterRuleRecord(rule);
		if (ruleIndex !== index) {
			return current;
		}
		return toFilterRuleRecord({
			environments: patch.environments !== undefined ? patch.environments : current.environments,
			xpath: patch.xpath !== undefined ? patch.xpath.trim() : current.xpath,
			description: patch.description !== undefined ? patch.description : current.description,
			activated: patch.activated !== undefined ? patch.activated : current.activated,
		});
	});
}

export function removeXPathFilterRule(rules: unknown[], index: number): unknown[] {
	if (index < 0 || index >= rules.length) {
		return rules;
	}
	return rules.filter((_, ruleIndex) => ruleIndex !== index);
}
