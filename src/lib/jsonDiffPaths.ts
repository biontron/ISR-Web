/** Sammelt Pfade (dot/bracket-Notation) mit abweichenden Werten gegenüber baseline. */
export function collectChangedJsonPaths(
	baseline: unknown,
	current: unknown,
	prefix = ""
): Set<string> {
	const changed = new Set<string>();

	if (baseline === undefined && current === undefined) {
		return changed;
	}

	if (baseline === undefined || current === undefined) {
		if (prefix) changed.add(prefix);
		return changed;
	}

	if (typeof baseline !== typeof current) {
		if (prefix) changed.add(prefix);
		return changed;
	}

	if (baseline === null || current === null) {
		if (baseline !== current && prefix) changed.add(prefix);
		return changed;
	}

	if (typeof baseline !== "object") {
		if (JSON.stringify(baseline) !== JSON.stringify(current) && prefix) {
			changed.add(prefix);
		}
		return changed;
	}

	const baselineIsArray = Array.isArray(baseline);
	const currentIsArray = Array.isArray(current);
	if (baselineIsArray !== currentIsArray) {
		if (prefix) changed.add(prefix);
		return changed;
	}

	if (baselineIsArray && currentIsArray) {
		const baseArr = baseline as unknown[];
		const currArr = current as unknown[];
		const maxLen = Math.max(baseArr.length, currArr.length);
		for (let i = 0; i < maxLen; i++) {
			const childPath = prefix ? `${prefix}[${i}]` : `[${i}]`;
			if (i >= baseArr.length || i >= currArr.length) {
				changed.add(childPath);
				continue;
			}
			collectChangedJsonPaths(baseArr[i], currArr[i], childPath).forEach((p) =>
				changed.add(p)
			);
		}
		return changed;
	}

	const baseObj = baseline as Record<string, unknown>;
	const currObj = current as Record<string, unknown>;
	const keyList = Object.keys({ ...baseObj, ...currObj });

	for (let i = 0; i < keyList.length; i++) {
		const key = keyList[i];
		const childPath = prefix ? `${prefix}.${key}` : key;
		if (!(key in baseObj) || !(key in currObj)) {
			changed.add(childPath);
			continue;
		}
		collectChangedJsonPaths(baseObj[key], currObj[key], childPath).forEach((p) =>
			changed.add(p)
		);
	}

	return changed;
}

export function isJsonPathChanged(path: string, changedPaths: Set<string>): boolean {
	if (!path) {
		return false;
	}
	if (changedPaths.has(path)) {
		return true;
	}
	return Array.from(changedPaths).some(
		(changedPath) =>
			changedPath.startsWith(`${path}.`) || changedPath.startsWith(`${path}[`)
	);
}
