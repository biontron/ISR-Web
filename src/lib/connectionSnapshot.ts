import { IAsset } from "../Stores/Models/Asset.Model";
import { IDock, IDockpart } from "../Stores/Models/Dock.Model";
import { IConnection, ILink, ILinkpart } from "../Stores/Models/Connection.Model";
import { formatAssetDisplayName } from "./connectionEndpointRef";
import { PairedLinkpartSnapshot } from "./connectionDockpartPairing";

export type ComponentRefSnapshot = {
	id: string;
	label: string;
};

export type ValueSnapshotMap = Record<string, unknown>;

export function collectDockpartValueSnapshot(part: IDockpart): ValueSnapshotMap {
	const result: ValueSnapshotMap = {};

	if (part.settings && typeof part.settings.forEach === "function") {
		part.settings.forEach((value, key) => {
			result[String(key)] = value;
		});
	}

	if (part.schemaExtensions && typeof part.schemaExtensions.forEach === "function") {
		part.schemaExtensions.forEach((value, key) => {
			result[String(key)] = value;
		});
	}

	return result;
}

export function buildComponentRefSnapshot(asset: IAsset | undefined): ComponentRefSnapshot | undefined {
	if (!asset) {
		return undefined;
	}
	return {
		id: asset.id,
		label: formatAssetDisplayName(asset),
	};
}

export function enrichPairedLinkpartsWithSnapshots(
	fromDock: IDock,
	toDock: IDock,
	linkparts: PairedLinkpartSnapshot[]
): Array<PairedLinkpartSnapshot & { fromValueSnapshot?: ValueSnapshotMap; toValueSnapshot?: ValueSnapshotMap }> {
	return linkparts.map((part) => {
		const fromPart = fromDock.dockparts.find((entry) => String(entry.id) === part.fromDockpartRef);
		const toPart = toDock.dockparts.find((entry) => String(entry.id) === part.toDockpartRef);
		return {
			...part,
			fromValueSnapshot: fromPart ? collectDockpartValueSnapshot(fromPart) : undefined,
			toValueSnapshot: toPart ? collectDockpartValueSnapshot(toPart) : undefined,
		};
	});
}

export type BuiltLinkSnapshotBase = {
	fromComponentRef: string | null;
	fromDockRef: string;
	fromLabelSnapshot: string;
	toComponentRef: string | null;
	toDockRef: string;
	toLabelSnapshot: string;
	linkparts: PairedLinkpartSnapshot[];
};

export type BuiltLinkSnapshot = BuiltLinkSnapshotBase & {
	fromComponentRefSnapshot?: ComponentRefSnapshot;
	toComponentRefSnapshot?: ComponentRefSnapshot;
	linkparts: Array<
		PairedLinkpartSnapshot & {
			fromValueSnapshot?: ValueSnapshotMap;
			toValueSnapshot?: ValueSnapshotMap;
		}
	>;
};

export function enrichBuiltLinkSnapshot(
	assets: IAsset[],
	snapshot: BuiltLinkSnapshotBase,
	fromAssetId: string,
	toAssetId: string,
	fromDockId: string,
	toDockId: string
): BuiltLinkSnapshot {
	const fromAsset = assets.find((asset) => asset.id === fromAssetId);
	const toAsset = assets.find((asset) => asset.id === toAssetId);
	const fromDock = fromAsset?.docks.find((dock) => String(dock.id) === fromDockId);
	const toDock = toAsset?.docks.find((dock) => String(dock.id) === toDockId);

	return {
		...snapshot,
		fromComponentRefSnapshot: buildComponentRefSnapshot(fromAsset),
		toComponentRefSnapshot: buildComponentRefSnapshot(toAsset),
		linkparts:
			fromDock && toDock
				? enrichPairedLinkpartsWithSnapshots(fromDock, toDock, snapshot.linkparts)
				: snapshot.linkparts,
	};
}

function findDockpartInAssets(assets: IAsset[], dockpartRef: string): IDockpart | undefined {
	for (const asset of assets) {
		for (const dock of asset.docks) {
			for (const part of dock.dockparts) {
				if (String(part.id) === dockpartRef) {
					return part;
				}
			}
		}
	}
	return undefined;
}

export function resolveLinkpartDisplayValues(
	linkpart: ILinkpart,
	side: "from" | "to",
	assets: IAsset[]
): ValueSnapshotMap {
	const snapshotKey = side === "from" ? "fromValueSnapshot" : "toValueSnapshot";
	const stored = (linkpart as ILinkpart & Record<string, unknown>)[snapshotKey];
	if (stored && typeof stored === "object" && !Array.isArray(stored)) {
		return stored as ValueSnapshotMap;
	}

	const dockpartRef = side === "from" ? linkpart.fromDockpartRef : linkpart.toDockpartRef;
	const part = findDockpartInAssets(assets, dockpartRef);
	return part ? collectDockpartValueSnapshot(part) : {};
}

export function freezeConnectionSnapshotsForAsset(
	assetId: string,
	connections: IConnection[],
	assets: IAsset[]
): void {
	for (const connection of connections) {
		for (const link of connection.links) {
			freezeLinkSnapshotsForAsset(link, assetId, assets);
		}
	}
}

function freezeLinkSnapshotsForAsset(link: ILink, assetId: string, assets: IAsset[]): void {
	const touchesFrom = link.fromComponentRef === assetId;
	const touchesTo = link.toComponentRef === assetId;
	if (!touchesFrom && !touchesTo) {
		return;
	}

	const fromAsset = link.fromComponentRef
		? assets.find((asset) => asset.id === link.fromComponentRef)
		: undefined;
	const toAsset = link.toComponentRef
		? assets.find((asset) => asset.id === link.toComponentRef)
		: undefined;

	if (touchesFrom && fromAsset) {
		const snapshot = buildComponentRefSnapshot(fromAsset);
		if (snapshot) {
			(link as ILink & { fromComponentRefSnapshot?: ComponentRefSnapshot }).fromComponentRefSnapshot =
				snapshot;
		}
		if (!link.fromLabelSnapshot?.trim()) {
			link.fromLabelSnapshot = snapshot?.label ?? "";
		}
	}

	if (touchesTo && toAsset) {
		const snapshot = buildComponentRefSnapshot(toAsset);
		if (snapshot) {
			(link as ILink & { toComponentRefSnapshot?: ComponentRefSnapshot }).toComponentRefSnapshot =
				snapshot;
		}
		if (!link.toLabelSnapshot?.trim()) {
			link.toLabelSnapshot = snapshot?.label ?? "";
		}
	}

	for (const linkpart of link.linkparts) {
		if (touchesFrom && linkpart.fromDockpartRef) {
			const part = findDockpartInAssets(assets, linkpart.fromDockpartRef);
			if (part) {
				(linkpart as ILinkpart & { fromValueSnapshot?: ValueSnapshotMap }).fromValueSnapshot =
					collectDockpartValueSnapshot(part);
			}
		}
		if (touchesTo && linkpart.toDockpartRef) {
			const part = findDockpartInAssets(assets, linkpart.toDockpartRef);
			if (part) {
				(linkpart as ILinkpart & { toValueSnapshot?: ValueSnapshotMap }).toValueSnapshot =
					collectDockpartValueSnapshot(part);
			}
		}
	}
}
