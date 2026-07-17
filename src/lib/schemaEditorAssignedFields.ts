/** Felder, die beim Anlegen per Add-Defaults gesetzt werden und nicht manuell geändert werden dürfen. */
export function isSchemaAssignedIdField(
	schemaName: string | undefined,
	fieldItemName: string,
	dataPath: string
): boolean {
	if (fieldItemName !== "id") {
		return false;
	}

	if (schemaName === "COMPONENT-DOCKS") {
		return (
			/^docks\[\d+\]\.id$/.test(dataPath) ||
			/^docks\[\d+\]\.dockparts\[\d+\]\.id$/.test(dataPath)
		);
	}

	if (schemaName === "CONNECTION") {
		return /^links\[\d+\]\.id$/.test(dataPath);
	}

	return false;
}

export function resolveAssignedIdAddContext(
	dataPath: string
): { dataPathPrefix: string; siblingArrayPath: string } | undefined {
	const dockIdMatch = dataPath.match(/^docks\[\d+\]\.id$/);
	if (dockIdMatch) {
		return { dataPathPrefix: "docks", siblingArrayPath: "docks" };
	}

	const dockpartIdMatch = dataPath.match(/^(docks\[\d+\]\.dockparts)\[\d+\]\.id$/);
	if (dockpartIdMatch) {
		return {
			dataPathPrefix: dockpartIdMatch[1],
			siblingArrayPath: dockpartIdMatch[1],
		};
	}

	const linkIdMatch = dataPath.match(/^links\[\d+\]\.id$/);
	if (linkIdMatch) {
		return { dataPathPrefix: "links", siblingArrayPath: "links" };
	}

	const linkpartIdMatch = dataPath.match(/^(.+\.linkparts)\[\d+\]\.id$/);
	if (linkpartIdMatch) {
		return {
			dataPathPrefix: linkpartIdMatch[1],
			siblingArrayPath: linkpartIdMatch[1],
		};
	}

	return undefined;
}
