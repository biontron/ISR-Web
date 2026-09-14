/*
  ========================================================================
  LICENSE AGREEMENT:
  ...
  ========================================================================
*/

import { Instance, flow, getRoot, types } from "mobx-state-tree";
import { BaseStore } from "./Base.Store";
import { ConnectionModel, IConnection } from "./Models/Connection.Model";
import { stampEnvironmentId } from "../lib/environmentIdentity";
import {
	knownEnvironmentIds,
	resolveViewEnvironmentRefs,
	resolveWriteEnvironmentId,
} from "../lib/viewEnvironments";
import { IRootStore } from "./Root.Store";
import authStore from "./Auth.Store";
import api from "../lib/api";
import { generateResourceID } from "../lib/common";
import { saveElement } from "../lib/activityStatusActions";
import { resolveFieldValueOnAdd } from "../lib/schemaAddFieldDefaults";
import {
	createRestLoadFailureReport,
	enrichRestLoadReport,
	loadRestArrayIntoStore,
	normalizeRestArray,
	publishRestLoadReport,
} from "../lib/restSnapshot";
import { IAsset } from "./Models/Asset.Model";
import { IGroup } from "./Models/Group.Model";
import {
	connectionTouchesAsset,
	connectionTouchesEndpoint,
	formatAssetDisplayName,
	parseDockEndpointRef,
	parseDockRef,
	resolveConnectionEndpointSide,
} from "../lib/connectionEndpointRef";
import {
	formatLogicalEndpointName,
	resolveLogicalEndpoint,
	connectionTouchesGroup,
} from "../lib/connectionLogicalEndpoints";
import { collectContextValues, matchingContextValuesForDockpart } from "../lib/connectionContextValues";
import { formatValueRef } from "../lib/connectionValueRef";
import { ConnectionDirection } from "../lib/connectionDirection";
import { PairedLinkpartSnapshot } from "../lib/connectionDockpartPairing";
import {
	BuiltLinkSnapshot,
	buildSingleLinkSnapshot,
	DockSelectionByAsset,
	buildLinksFromStackDrafts,
	collectStackLinkDrafts,
} from "../lib/connectionStackTraversal";
import { resolveAssetStackChain } from "../lib/connectionStackChain";

function writeEnvironmentId(
	root: IRootStore,
	...preferred: Array<string | null | undefined>
): string {
	return resolveWriteEnvironmentId(
		knownEnvironmentIds(root),
		root.ui.activeView,
		...preferred
	);
}

export type { ConnectionDirection };

export type CreateWithLinkpartsInput = {
	fromAssetId: string;
	fromDockId: string;
	fromDockpartIds: string[];
	toAssetId: string;
	toDockId: string;
	toDockpartIds: string[];
	linkTitle?: string;
	definitionLabel?: string;
	definitionDescription?: string;
	direction?: ConnectionDirection;
	includeAssetRefs?: boolean;
};

export type CreateLogicalConnectionInput = {
	fromAssetId?: string;
	toAssetId?: string;
	fromElementId?: string;
	toElementId?: string;
	title?: string;
	definitionLabel?: string;
	definitionDescription?: string;
	direction?: ConnectionDirection;
	purpose?: string;
	owner?: string;
};

export type CreateContextConnectionInput = {
	fromAssetId: string;
	toContextId: string;
	fromDockId: string;
	fromDockpartId: string;
	contextValueId: string;
	title?: string;
	definitionLabel?: string;
	definitionDescription?: string;
};

export type CreateBridgeConnectionInput = {
	fromAssetId: string;
	toAssetId?: string;
	peerEnvironmentRef: string;
	peerConnectionRef?: string;
	bridgeId?: string;
	title?: string;
	definitionLabel?: string;
	definitionDescription?: string;
	direction?: ConnectionDirection;
};

export type CreateWithStackAnchorsInput = {
	fromAnchorAssetId: string;
	toAnchorAssetId: string;
	fromDockSelections: DockSelectionByAsset;
	toDockSelections: DockSelectionByAsset;
	linkTitle?: string;
	definitionLabel?: string;
	definitionDescription?: string;
	direction?: ConnectionDirection;
};

function defaultLinkMetadata(purpose = "", owner = "") {
	return { status: "established", purpose, owner };
}

function snapshotLinkparts(linkparts: PairedLinkpartSnapshot[]) {
	return linkparts.map((part) => ({
		fromLabelSnapshot: part.fromLabelSnapshot,
		toLabelSnapshot: part.toLabelSnapshot,
		fromDockpartRef: part.fromDockpartRef,
		toDockpartRef: part.toDockpartRef,
		stackOrder: part.stackOrder,
	}));
}

function snapshotToLink(
	linkId: string,
	snapshot: BuiltLinkSnapshot,
	title: string,
	direction: ConnectionDirection,
	metadata = defaultLinkMetadata()
) {
	return {
		id: linkId,
		title,
		fromComponentRef: snapshot.fromComponentRef,
		fromDockRef: snapshot.fromDockRef,
		fromLabelSnapshot: snapshot.fromLabelSnapshot,
		toComponentRef: snapshot.toComponentRef,
		toDockRef: snapshot.toDockRef,
		toLabelSnapshot: snapshot.toLabelSnapshot,
		direction,
		linkparts: snapshotLinkparts(snapshot.linkparts),
		credentials: [],
		metadata,
	};
}

export const ConnectionStore = types.compose("ConnectionStore", BaseStore, types.model({
	connections: types.optional(types.array(types.late(() => ConnectionModel)), []),
}).actions(self => {

	function findById(id: string) {
		return self.connections.find((item) => item.id === id);
	}

	function findByEndpointRef(endpointRef: string) {
		return self.connections.find((item) => connectionTouchesEndpoint(item, endpointRef));
	}

	function findAllByEndpointRef(endpointRef: string) {
		return self.connections.filter((item) => connectionTouchesEndpoint(item, endpointRef));
	}

	function nextLinkId(): string {
		const existing = self.connections.flatMap((conn) =>
			conn.links.map((link) => String(link.id))
		);
		const resolved = resolveFieldValueOnAdd(
			{
				dataStructure: { itemName: "id", default: "" },
				rules: "[0-9A-Z\\-_#]+",
			} as any,
			{ element: self, dataPathPrefix: "links", siblingArrayPath: "links" }
		);
		return String(resolved ?? existing.length + 1);
	}

	function createWithEndpoints(
		fromDockRef: string,
		toDockRef: string,
		linkTitle: string = "New Connection"
	) {
		const root = getRoot(self) as IRootStore;
		const assets = root.assets.assets.slice();
		const from = resolveConnectionEndpointSide(assets, fromDockRef);
		const to = resolveConnectionEndpointSide(assets, toDockRef);
		const fromDockId = parseDockRef(fromDockRef);
		const toDockId = parseDockRef(toDockRef);
		const fromPartId = parseDockEndpointRef(fromDockRef)?.dockpartId;
		const toPartId = parseDockEndpointRef(toDockRef)?.dockpartId;
		const fromAsset = assets.find((asset) => asset.id === from?.assetId);
		const toAsset = assets.find((asset) => asset.id === to?.assetId);
		const fromDock = fromAsset?.docks.find((dock) => String(dock.id) === fromDockId);
		const toDock = toAsset?.docks.find((dock) => String(dock.id) === toDockId);

		if (fromDock && toDock && fromDockId && toDockId && fromPartId && toPartId && from && to) {
			return createWithLinkparts({
				fromAssetId: from.assetId,
				fromDockId,
				fromDockpartIds: [fromPartId],
				toAssetId: to.assetId,
				toDockId,
				toDockpartIds: [toPartId],
				linkTitle,
			});
		}

		const id = generateResourceID("Connection");
		const linkId = nextLinkId();
		const newConnection = ConnectionModel.create({
			id,
			definition: { label: "", description: "" },
			settings: {},
			links: [
				{
					id: linkId,
					title: linkTitle,
					fromComponentRef: from?.assetId ?? null,
					fromDockRef,
					fromLabelSnapshot: from?.dockLabel ?? "",
					toComponentRef: to?.assetId ?? null,
					toDockRef,
					toLabelSnapshot: to?.dockLabel ?? "",
					direction: "DUAL",
					linkparts: [],
					credentials: [],
					metadata: defaultLinkMetadata(),
				},
			],
		});
		self.connections.push(newConnection);
		newConnection.setStatus("new");
		newConnection.beginEdit();
		return newConnection;
	}

	function resolveLogicalSide(elementId: string) {
		const root = getRoot(self) as IRootStore;
		const element = resolveLogicalEndpoint(
			root.assets.assets.slice(),
			root.groups.groups.slice(),
			elementId
		);
		if (!element) {
			throw new Error(`Endpunkt '${elementId}' für logische Connection konnte nicht aufgelöst werden.`);
		}
		const environmentId =
			element.class === "Asset" ? (element as IAsset).environmentId : "";
		return {
			id: element.id,
			name: formatLogicalEndpointName(element),
			environmentId,
		};
	}

	function applyDockpartValueRef(asset: IAsset, dockpartId: string, valueRef: string) {
		for (const dock of asset.docks) {
			const part = dock.dockparts.find((entry) => String(entry.id) === dockpartId);
			if (!part) {
				continue;
			}
			asset.beginEdit();
			part.setValueRef(valueRef);
			asset.markTouched();
			return;
		}
		throw new Error(`Dockpart '${dockpartId}' für valueRef nicht gefunden.`);
	}

	function createLogicalConnection(input: CreateLogicalConnectionInput) {
		const root = getRoot(self) as IRootStore;
		const fromId = input.fromElementId ?? input.fromAssetId ?? "";
		const toId = input.toElementId ?? input.toAssetId ?? "";
		const fromSide = resolveLogicalSide(fromId);
		const toSide = resolveLogicalSide(toId);

		const trimmedTitle = input.title?.trim();
		const linkTitle = trimmedTitle || `${fromSide.name} ↔ ${toSide.name}`;
		const definitionLabel = input.definitionLabel?.trim() ?? trimmedTitle ?? "";
		const definitionDescription = input.definitionDescription?.trim() ?? "";
		const direction = input.direction ?? "DUAL";

		const id = generateResourceID("Connection");
		const linkId = nextLinkId();
		const newConnection = ConnectionModel.create({
			id,
			environmentId: writeEnvironmentId(root, fromSide.environmentId),
			kind: "logical",
			definition: { label: definitionLabel, description: definitionDescription },
			settings: {},
			links: [
				{
					id: linkId,
					title: linkTitle,
					fromComponentRef: fromSide.id,
					fromDockRef: "",
					fromLabelSnapshot: fromSide.name,
					toComponentRef: toSide.id,
					toDockRef: "",
					toLabelSnapshot: toSide.name,
					direction,
					linkparts: [],
					credentials: [],
					metadata: defaultLinkMetadata(input.purpose ?? "", input.owner ?? ""),
				},
			],
		});
		self.connections.push(newConnection);
		newConnection.setStatus("new");
		newConnection.beginEdit();
		return newConnection;
	}

	function createContextConnection(input: CreateContextConnectionInput) {
		const root = getRoot(self) as IRootStore;
		const fromAsset = root.assets.assets.find((asset) => asset.id === input.fromAssetId);
		const contextAsset = root.assets.assets.find((asset) => asset.id === input.toContextId);
		if (!fromAsset || !contextAsset) {
			throw new Error("Component oder Context-Component für Context-Connection nicht gefunden.");
		}
		const fromDock = fromAsset.docks.find((dock) => String(dock.id) === input.fromDockId);
		const fromPart = fromDock?.dockparts.find((part) => String(part.id) === input.fromDockpartId);
		if (!fromDock || !fromPart) {
			throw new Error("Dockpart der Component für Context-Connection nicht gefunden.");
		}
		const contextValues = collectContextValues(contextAsset);
		const chosen = contextValues.find((value) => value.valueId === input.contextValueId);
		if (!chosen) {
			throw new Error("Context-Wert nicht gefunden. Die Context-Component hat keinen passenden Dockpart.");
		}
		const matches = matchingContextValuesForDockpart([contextAsset], fromPart);
		if (matches.length > 0 && !matches.some((value) => value.valueId === chosen.valueId)) {
			throw new Error("Context-Wert passt nicht zur Dockpart-Schicht.");
		}

		const valueRef = formatValueRef(contextAsset.id, chosen.valueId);
		applyDockpartValueRef(fromAsset, String(fromPart.id), valueRef);

		const contextDock = contextAsset.docks.find((dock) => String(dock.id) === chosen.dockId);
		const fromName = formatAssetDisplayName(fromAsset);
		const toName = formatAssetDisplayName(contextAsset);
		const trimmedTitle = input.title?.trim();
		const linkTitle = trimmedTitle || `${fromName} → ${toName} (${chosen.label})`;
		const id = generateResourceID("Connection");
		const newConnection = ConnectionModel.create({
			id,
			environmentId: writeEnvironmentId(root, fromAsset.environmentId),
			kind: "context",
			definition: {
				label: input.definitionLabel?.trim() ?? trimmedTitle ?? "",
				description: input.definitionDescription?.trim() ?? "",
			},
			settings: {},
			links: [
				{
					id: nextLinkId(),
					title: linkTitle,
					fromComponentRef: fromAsset.id,
					fromDockRef: String(fromDock.id),
					fromLabelSnapshot: fromDock.label || fromDock.type || fromName,
					toComponentRef: contextAsset.id,
					toDockRef: chosen.dockId,
					toLabelSnapshot: contextDock?.label || contextDock?.type || toName,
					direction: "OUT",
					linkparts: [
						{
							fromLabelSnapshot: fromPart.label || fromPart.type || fromName,
							toLabelSnapshot: chosen.label,
							fromDockpartRef: String(fromPart.id),
							toDockpartRef: chosen.valueId,
							stackOrder: 0,
						},
					],
					credentials: [],
					metadata: defaultLinkMetadata(),
				},
			],
		});
		self.connections.push(newConnection);
		newConnection.setStatus("new");
		newConnection.beginEdit();
		return newConnection;
	}

	function createBridgeConnection(input: CreateBridgeConnectionInput) {
		const root = getRoot(self) as IRootStore;
		const fromAsset = root.assets.assets.find((asset) => asset.id === input.fromAssetId);
		if (!fromAsset) {
			throw new Error("From-Asset für Brücke nicht gefunden.");
		}
		const toAsset = input.toAssetId
			? root.assets.assets.find((asset) => asset.id === input.toAssetId)
			: undefined;
		if (input.toAssetId && !toAsset) {
			throw new Error("To-Asset für Brücke nicht gefunden.");
		}
		const fromName = formatAssetDisplayName(fromAsset);
		const toName = toAsset ? formatAssetDisplayName(toAsset) : input.peerEnvironmentRef;
		const trimmedTitle = input.title?.trim();
		const linkTitle = trimmedTitle || `${fromName} ↔ ${toName}`;
		const id = generateResourceID("Connection");
		const newConnection = ConnectionModel.create({
			id,
			environmentId: writeEnvironmentId(root, fromAsset.environmentId),
			kind: "bridge",
			bridgeId: input.bridgeId?.trim() ?? "",
			peerEnvironmentRef: input.peerEnvironmentRef.trim(),
			peerConnectionRef: input.peerConnectionRef?.trim() ?? "",
			definition: {
				label: input.definitionLabel?.trim() ?? trimmedTitle ?? "",
				description: input.definitionDescription?.trim() ?? "",
			},
			settings: {},
			links: [
				{
					id: nextLinkId(),
					title: linkTitle,
					fromComponentRef: fromAsset.id,
					fromDockRef: "",
					fromLabelSnapshot: fromName,
					toComponentRef: toAsset?.id ?? null,
					toDockRef: "",
					toLabelSnapshot: toName,
					direction: input.direction ?? "DUAL",
					linkparts: [],
					credentials: [],
					metadata: defaultLinkMetadata(),
				},
			],
		});
		self.connections.push(newConnection);
		newConnection.setStatus("new");
		newConnection.beginEdit();
		return newConnection;
	}

	function createWithLinkparts(input: CreateWithLinkpartsInput) {
		const root = getRoot(self) as IRootStore;
		const assets = root.assets.assets.slice();
		const snapshot = buildSingleLinkSnapshot(assets, {
			fromAssetId: input.fromAssetId,
			fromDockId: input.fromDockId,
			fromDockpartIds: input.fromDockpartIds,
			toAssetId: input.toAssetId,
			toDockId: input.toDockId,
			toDockpartIds: input.toDockpartIds,
			includeAssetRefs: input.includeAssetRefs,
		});

		const from = resolveConnectionEndpointSide(assets, snapshot.fromDockRef);
		const to = resolveConnectionEndpointSide(assets, snapshot.toDockRef);
		const linkTitle =
			input.linkTitle ??
			(from && to
				? `${from.assetName} (${from.dockLabel}) ↔ ${to.assetName} (${to.dockLabel})`
				: "New Connection");
		const definitionLabel = input.definitionLabel?.trim() ?? "";
		const definitionDescription = input.definitionDescription?.trim() ?? "";
		const direction = input.direction ?? "DUAL";

		const id = generateResourceID("Connection");
		const linkId = nextLinkId();
		const fromAsset = assets.find((asset) => asset.id === input.fromAssetId);
		const newConnection = ConnectionModel.create({
			id,
			environmentId: writeEnvironmentId(root, fromAsset?.environmentId),
			kind: "link",
			definition: { label: definitionLabel, description: definitionDescription },
			settings: {},
			links: [
				snapshotToLink(linkId, snapshot, linkTitle, direction),
			],
		});
		self.connections.push(newConnection);
		newConnection.setStatus("new");
		newConnection.beginEdit();
		return newConnection;
	}

	function createWithStackAnchors(input: CreateWithStackAnchorsInput) {
		const root = getRoot(self) as IRootStore;
		const assets = root.assets.assets.slice();
		const fromChain = resolveAssetStackChain(input.fromAnchorAssetId, assets);
		const toChain = resolveAssetStackChain(input.toAnchorAssetId, assets);
		if (fromChain.length === 0 || toChain.length === 0) {
			throw new Error("Stack-Kette konnte nicht aufgelöst werden.");
		}

		const drafts = collectStackLinkDrafts(
			fromChain,
			toChain,
			input.fromDockSelections,
			input.toDockSelections
		);
		const snapshots = buildLinksFromStackDrafts(assets, drafts);
		if (snapshots.length === 0) {
			throw new Error("Keine Links aus Stack-Auswahl erzeugt.");
		}

		const definitionLabel = input.definitionLabel?.trim() ?? "";
		const definitionDescription = input.definitionDescription?.trim() ?? "";
		const direction = input.direction ?? "DUAL";
		const defaultTitle =
			input.linkTitle?.trim() ||
			`${formatAssetDisplayName(fromChain[fromChain.length - 1])} ↔ ${formatAssetDisplayName(toChain[toChain.length - 1])}`;

		const links = snapshots.map((snapshot, index) => {
			const baseId = nextLinkId();
			const linkId = index === 0 ? baseId : `${baseId}-${index + 1}`;
			const title =
				snapshots.length === 1
					? defaultTitle
					: `${defaultTitle} (#${index + 1})`;
			return snapshotToLink(linkId, snapshot, title, direction);
		});

		const id = generateResourceID("Connection");
		const newConnection = ConnectionModel.create({
			id,
			environmentId: writeEnvironmentId(root, fromChain[0]?.environmentId),
			kind: "link",
			definition: { label: definitionLabel, description: definitionDescription },
			settings: {},
			links,
		});
		self.connections.push(newConnection);
		newConnection.setStatus("new");
		newConnection.beginEdit();
		return newConnection;
	}

	const store = flow(function* saveData(connectionID: string) {
		const root = getRoot(self) as IRootStore;
		const data = self.connections.find((c) => c.id === connectionID);
		if (!data) {
			return { saved: 0, failed: [] };
		}
		return yield saveElement(root, data);
	});

	function removeLocal(connection: IConnection) {
		const entry =
			self.connections.find((item) => item.id === connection.id) ?? connection;
		if (self.connections.includes(entry)) {
			self.connections.remove(entry);
		}
	}

	function remove(connectionId: string) {
		const conn = self.connections.find(
			(connection: IConnection) => connection.id === connectionId
		);
		if (!conn) {
			return;
		}
		if (conn.status === "new") {
			removeLocal(conn);
			return;
		}
		conn.stageDelete();
	}

	const load = flow(function* load() {
		const root = getRoot(self) as IRootStore;
		const domain = authStore.getDomain();
		const environmentIds = resolveViewEnvironmentRefs(
			root.ui.activeView,
			knownEnvironmentIds(root)
		);
		const restUrlIds = { env: environmentIds[0] };
		if (!domain) {
			return;
		}

		try {
			const merged: unknown[] = [];
			const seen = new Set<string>();
			for (const environmentId of environmentIds) {
				const jsonData = yield api.getConnections(domain, environmentId);
				const { items } = normalizeRestArray(jsonData);
				for (const item of items) {
					if (!item || typeof item !== "object") {
						continue;
					}
					const stamped = stampEnvironmentId(item as Record<string, unknown>, environmentId);
					const id = String(stamped.id ?? "");
					if (!id || seen.has(id)) {
						continue;
					}
					seen.add(id);
					merged.push(stamped);
				}
			}
			const report = enrichRestLoadReport(
				loadRestArrayIntoStore(
					self.connections,
					ConnectionModel,
					merged,
					"Connection",
					{ domain, restUrlIds }
				),
				"Connection",
				domain,
				restUrlIds
			);
			publishRestLoadReport(report);
		} catch (error) {
			publishRestLoadReport(
				createRestLoadFailureReport("Connection", error, { domain, restUrlIds })
			);
		}
	});

	return {
		findById,
		findByEndpointRef,
		findAllByEndpointRef,
		createWithEndpoints,
		createLogicalConnection,
		createContextConnection,
		createBridgeConnection,
		applyDockpartValueRef,
		createWithLinkparts,
		createWithStackAnchors,
		store,
		remove,
		removeLocal,
		load,
	};
}));

export type IConnectionStore = Instance<typeof ConnectionStore>;

export function filterConnectionsForAssetEndpoints(
	connections: IConnection[],
	asset: IAsset,
	allAssets: IAsset[]
): IConnection[] {
	return connections.filter((connection) =>
		connectionTouchesAsset(connection, asset, allAssets)
	);
}

export function filterConnectionsForElement(
	connections: IConnection[],
	element: IAsset | IGroup,
	allAssets: IAsset[]
): IConnection[] {
	if (element.class === "Group") {
		return connections.filter((connection) => connectionTouchesGroup(connection, element.id));
	}
	return filterConnectionsForAssetEndpoints(connections, element as IAsset, allAssets);
}

export { parseDockEndpointRef };
