import { IConnection, ILink } from "../Stores/Models/Connection.Model";

export type ConnectionMode = "logical" | "link" | "layered" | "stackPath" | "bridge" | "context";

function isDockRefEmpty(ref: string | undefined | null): boolean {
	return !ref?.trim();
}

function linkHasLinkparts(link: ILink): boolean {
	return link.linkparts.length > 0;
}

function collectDistinctAssetRefs(links: ILink[], side: "from" | "to"): Set<string> {
	const key = side === "from" ? "fromComponentRef" : "toComponentRef";
	const values = new Set<string>();
	for (const link of links) {
		const ref = link[key]?.trim();
		if (ref) {
			values.add(ref);
		}
	}
	return values;
}

export function resolveConnectionMode(connection: IConnection): ConnectionMode {
	if (connection.kind === "bridge" || connection.kind === "context") {
		return connection.kind;
	}
	if (connection.kind === "link") {
		return "link";
	}
	const links = connection.links;
	if (links.length === 0) {
		return "logical";
	}

	const allLogical = links.every(
		(link) =>
			!linkHasLinkparts(link) &&
			isDockRefEmpty(link.fromDockRef) &&
			isDockRefEmpty(link.toDockRef)
	);
	if (allLogical) {
		return "logical";
	}

	const fromRefs = collectDistinctAssetRefs(links, "from");
	const toRefs = collectDistinctAssetRefs(links, "to");
	if (fromRefs.size > 1 || toRefs.size > 1) {
		return "stackPath";
	}

	if (links.some((link) => linkHasLinkparts(link))) {
		return "layered";
	}

	return "logical";
}

export type RefineTargetMode = "layered" | "stackPath";

export function canRefineConnection(
	connection: IConnection,
	targetMode: RefineTargetMode
): boolean {
	const current = resolveConnectionMode(connection);
	if (targetMode === "layered") {
		return current === "logical";
	}
	return current === "logical" || current === "layered";
}

export function connectionModeLabel(mode: ConnectionMode): string {
	switch (mode) {
		case "logical":
			return "Logisch";
		case "link":
			return "Link";
		case "layered":
			return "Layer";
		case "stackPath":
			return "Stack-Pfad";
		case "bridge":
			return "Brücke";
		case "context":
			return "Context";
		default:
			return mode;
	}
}
