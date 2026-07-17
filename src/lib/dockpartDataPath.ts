import { isDockpartCoreKey } from "../Stores/Models/Dock.Model";

const DOCKPART_ROOT_PATH = /^docks\[\d+\]\.dockparts\[\d+\]$/;
const DOCKPART_PATH = /^docks\[\d+\]\.dockparts\[\d+\](?:\.|$)/;

export function isDockpartRootDataPath(path: string): boolean {
	return DOCKPART_ROOT_PATH.test(path);
}

export function isDockpartDataPath(path: string): boolean {
	return DOCKPART_PATH.test(path);
}

/** Ergänzt fehlendes settings-Segment für schema-gesteuerte Dockpart-Felder. */
export function resolveDockpartDataPathPrefix(pathPrefix: string): string {
	const match = pathPrefix.match(/^(docks\[\d+\]\.dockparts\[\d+\])(?:\.(.+))?$/);
	if (!match) {
		return pathPrefix;
	}

	const base = match[1];
	const suffix = match[2];
	if (!suffix) {
		return pathPrefix;
	}
	if (suffix === "settings" || suffix.startsWith("settings.")) {
		return pathPrefix;
	}

	const firstSegment = suffix.split(".")[0]?.replace(/\[\d+\]$/, "") ?? "";
	if (isDockpartCoreKey(firstSegment)) {
		return pathPrefix;
	}

	return `${base}.settings.${suffix}`;
}

export function buildDockpartDataPath(pathPrefix: string, segment: string): string {
	if (!segment) {
		return pathPrefix;
	}

	if (!isDockpartDataPath(pathPrefix) && !DOCKPART_ROOT_PATH.test(pathPrefix)) {
		return pathPrefix ? `${pathPrefix}.${segment}` : segment;
	}

	if (isDockpartCoreKey(segment)) {
		return pathPrefix ? `${pathPrefix}.${segment}` : segment;
	}

	let normalizedPrefix = pathPrefix;
	if (DOCKPART_ROOT_PATH.test(pathPrefix)) {
		normalizedPrefix = `${pathPrefix}.settings`;
	} else {
		normalizedPrefix = resolveDockpartDataPathPrefix(pathPrefix);
	}

	return normalizedPrefix ? `${normalizedPrefix}.${segment}` : segment;
}
