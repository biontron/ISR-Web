export function isParentTypeInSchemaWhitelist(parentType: string, whitelist: string[]): boolean {
	return whitelist.includes(parentType) || whitelist.includes("ANY");
}

export function isParentTypeInSchemaBlacklist(parentType: string, blacklist: string[]): boolean {
	return blacklist.includes(parentType) || blacklist.includes("ANY") || blacklist.includes("");
}

export function isAllowedParentElementType(
	parentType: string,
	whitelist: string[],
	blacklist: string[]
): boolean {
	if (!parentType) {
		return false;
	}
	return (
		isParentTypeInSchemaWhitelist(parentType, whitelist) &&
		!isParentTypeInSchemaBlacklist(parentType, blacklist)
	);
}

/** Prüft, ob ein Schema-Typ/ID als Parent für ein Child-Schema zulässig ist. */
export function isAllowedParentForChildSchema(
	parentType: string,
	parentId: string,
	childWhitelist: string[],
	childBlacklist: string[]
): boolean {
	if (isAllowedParentElementType(parentType, childWhitelist, childBlacklist)) {
		return true;
	}
	if (!parentId) {
		return false;
	}
	return childWhitelist.includes(parentId) && !childBlacklist.includes(parentId);
}

export function parentTypeHighlightTokens(whitelist: string[]): Set<string> {
	return new Set(whitelist.map((entry) => entry.trim()).filter(Boolean));
}
