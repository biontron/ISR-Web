export function indexById<T extends { id: string }>(items: ReadonlyArray<T>): Map<string, T> {
	const map = new Map<string, T>();
	for (const item of items) {
		map.set(item.id, item);
	}
	return map;
}

export function indexAssetsByOwnerId<T extends { ownerIdRef?: string | null }>(
	assets: ReadonlyArray<T>
): Map<string, T[]> {
	const map = new Map<string, T[]>();
	for (const asset of assets) {
		const ownerId = typeof asset.ownerIdRef === "string" ? asset.ownerIdRef.trim() : "";
		if (!ownerId) {
			continue;
		}
		const bucket = map.get(ownerId);
		if (bucket) {
			bucket.push(asset);
		} else {
			map.set(ownerId, [asset]);
		}
	}
	return map;
}

export function indexGroupsByParentId<T extends { parentIdRef?: string | null }>(
	groups: ReadonlyArray<T>
): Map<string, T[]> {
	const map = new Map<string, T[]>();
	for (const group of groups) {
		const parentId = typeof group.parentIdRef === "string" ? group.parentIdRef.trim() : "";
		if (!parentId) {
			continue;
		}
		const bucket = map.get(parentId);
		if (bucket) {
			bucket.push(group);
		} else {
			map.set(parentId, [group]);
		}
	}
	return map;
}

/** Struktur-Epoch: Parent- und elementIdRefs-Zuordnungen der Groups. */
export function hierarchyAssignmentEpoch(
	groups: ReadonlyArray<{
		parentIdRef?: string | null;
		elementIdRefs?: ReadonlyArray<{ id?: unknown }>;
	}>
): string {
	return groups
		.map(
			(group) =>
				`${group.parentIdRef ?? ""}:${(group.elementIdRefs ?? [])
					.map((ref) => String(ref.id ?? ""))
					.join(",")}`
		)
		.join("|");
}

export function hierarchyOwnerEpoch(
	assets: ReadonlyArray<{ ownerIdRef?: string | null }>
): string {
	return assets.map((asset) => asset.ownerIdRef ?? "").join(",");
}

/** Status-Epoch: volatile MST-Status, unabhängig von der Baumstruktur. */
export function hierarchyStatusEpoch(
	groups: ReadonlyArray<{ status?: string }>,
	assets: ReadonlyArray<{ status?: string }>
): string {
	return `${groups.map((group) => group.status ?? "").join(",")}|${assets
		.map((asset) => asset.status ?? "")
		.join(",")}`;
}
