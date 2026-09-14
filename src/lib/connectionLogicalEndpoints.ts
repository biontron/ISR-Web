import { IAsset } from "../Stores/Models/Asset.Model";
import { IGroup } from "../Stores/Models/Group.Model";

export type LogicalEndpointElement = IAsset | IGroup;

export function formatLogicalEndpointName(element: LogicalEndpointElement | undefined, fallback = "—"): string {
	if (!element) {
		return fallback;
	}
	return element.definition?.name?.trim() || element.definition?.label?.trim() || element.id;
}

export function resolveLogicalEndpoint(
	assets: ReadonlyArray<IAsset>,
	groups: ReadonlyArray<IGroup>,
	elementId: string
): LogicalEndpointElement | undefined {
	const trimmed = elementId.trim();
	if (!trimmed) {
		return undefined;
	}
	return (
		assets.find((asset) => asset.id === trimmed) ??
		groups.find((group) => group.id === trimmed)
	);
}

export function connectionTouchesGroup(
	connection: { links: ReadonlyArray<{ fromComponentRef?: string | null; toComponentRef?: string | null }> },
	groupId: string
): boolean {
	return connection.links.some(
		(link) => link.fromComponentRef === groupId || link.toComponentRef === groupId
	);
}

export function collectLogicalEndpointOptions(
	assets: ReadonlyArray<IAsset>,
	groups: ReadonlyArray<IGroup>,
	excludeId?: string
): Array<{ id: string; label: string; className: string }> {
	const options: Array<{ id: string; label: string; className: string }> = [];
	for (const asset of assets) {
		if (asset.id === excludeId) {
			continue;
		}
		options.push({
			id: asset.id,
			label: formatLogicalEndpointName(asset),
			className: asset.class,
		});
	}
	for (const group of groups) {
		if (group.id === excludeId) {
			continue;
		}
		options.push({
			id: group.id,
			label: `${formatLogicalEndpointName(group)} (Group)`,
			className: group.class,
		});
	}
	return options;
}
