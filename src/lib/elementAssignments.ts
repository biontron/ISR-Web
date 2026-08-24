import { IAsset } from "../Stores/Models/Asset.Model";
import { IGroup } from "../Stores/Models/Group.Model";
import { IRootStore } from "../Stores/Root.Store";

export type AssignableTreeElement = IGroup | IAsset;

export type XPathFilterRule = {
	xpath: string;
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

export function collectAssignedElements(
	root: Pick<IRootStore, "groups" | "assets">,
	parentId: string
): AssignableTreeElement[] {
	const groups = root.groups.groups.filter((group) => isAssignedToParent(group, parentId));
	const assets = root.assets.assets.filter((asset) => isAssignedToParent(asset, parentId));
	return [...groups, ...assets];
}

export function collectUnassignedElements(
	root: Pick<IRootStore, "groups" | "assets">,
	parentId: string
): AssignableTreeElement[] {
	const groups = root.groups.groups.filter(
		(group) => group.id !== parentId && isStaticallyUnassigned(group)
	);
	const assets = root.assets.assets.filter(
		(asset) =>
			asset.id !== parentId &&
			isStaticallyUnassigned(asset) &&
			!wouldCreateAssignmentCycle(asset, parentId, root)
	);
	return [...groups, ...assets];
}

export function readXPathExpression(rule: unknown): string {
	if (typeof rule === "string") {
		return rule.trim();
	}
	if (rule && typeof rule === "object") {
		const record = rule as Record<string, unknown>;
		const value = record.xpath ?? record.expression ?? record.filter;
		if (typeof value === "string") {
			return value.trim();
		}
	}
	return "";
}

export function toXPathFilterRule(expression: string): XPathFilterRule {
	return { xpath: expression.trim() };
}

export function addXPathFilterRule(rules: unknown[], expression: string): unknown[] {
	const xpath = expression.trim();
	if (!xpath) {
		return rules;
	}
	if (rules.some((rule) => readXPathExpression(rule) === xpath)) {
		return rules;
	}
	return [...rules, toXPathFilterRule(xpath)];
}

export function removeXPathFilterRule(rules: unknown[], index: number): unknown[] {
	if (index < 0 || index >= rules.length) {
		return rules;
	}
	return rules.filter((_, ruleIndex) => ruleIndex !== index);
}
