/*
  ========================================================================
  LICENSE AGREEMENT:
  ...
  ========================================================================
*/

import { Instance, flow, getRoot, types } from "mobx-state-tree";
import { BaseStore } from "./Base.Store";
import { IConfig } from "./Models/Config.Model";
import { ConnectionModel, IConnection } from "./Models/Connection.Model";
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
import {
	connectionTouchesAsset,
	connectionTouchesEndpoint,
	formatAssetDisplayName,
	parseDockEndpointRef,
	resolveConnectionEndpointSide,
} from "../lib/connectionEndpointRef";
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
	fromAssetId: string;
	toAssetId: string;
	title?: string;
	definitionLabel?: string;
	definitionDescription?: string;
	direction?: ConnectionDirection;
	purpose?: string;
	owner?: string;
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
		const parsedFrom = parseDockEndpointRef(fromDockRef);
		const parsedTo = parseDockEndpointRef(toDockRef);
		const fromAsset = assets.find((asset) => asset.id === from?.assetId);
		const toAsset = assets.find((asset) => asset.id === to?.assetId);
		const fromDock = fromAsset?.docks.find((dock) => String(dock.id) === parsedFrom?.dockId);
		const toDock = toAsset?.docks.find((dock) => String(dock.id) === parsedTo?.dockId);

		if (fromDock && toDock && parsedFrom && parsedTo && from && to) {
			return createWithLinkparts({
				fromAssetId: from.assetId,
				fromDockId: parsedFrom.dockId,
				fromDockpartIds: [parsedFrom.dockpartId],
				toAssetId: to.assetId,
				toDockId: parsedTo.dockId,
				toDockpartIds: [parsedTo.dockpartId],
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

	function createLogicalConnection(input: CreateLogicalConnectionInput) {
		const root = getRoot(self) as IRootStore;
		const assets = root.assets.assets.slice();
		const fromAsset = assets.find((asset) => asset.id === input.fromAssetId);
		const toAsset = assets.find((asset) => asset.id === input.toAssetId);
		if (!fromAsset || !toAsset) {
			throw new Error("From/To-Asset für logische Connection konnte nicht aufgelöst werden.");
		}

		const fromName = formatAssetDisplayName(fromAsset);
		const toName = formatAssetDisplayName(toAsset);
		const trimmedTitle = input.title?.trim();
		const linkTitle = trimmedTitle || `${fromName} ↔ ${toName}`;
		const definitionLabel = input.definitionLabel?.trim() ?? trimmedTitle ?? "";
		const definitionDescription = input.definitionDescription?.trim() ?? "";
		const direction = input.direction ?? "DUAL";

		const id = generateResourceID("Connection");
		const linkId = nextLinkId();
		const newConnection = ConnectionModel.create({
			id,
			definition: { label: definitionLabel, description: definitionDescription },
			settings: {},
			links: [
				{
					id: linkId,
					title: linkTitle,
					fromComponentRef: fromAsset.id,
					fromDockRef: "",
					fromLabelSnapshot: fromName,
					toComponentRef: toAsset.id,
					toDockRef: "",
					toLabelSnapshot: toName,
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
		const newConnection = ConnectionModel.create({
			id,
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
		const config = root.config as IConfig;
		const domain = authStore.getDomain();
		const restUrlIds = { env: config.environment };
		if (!domain) {
			return;
		}

		try {
			const jsonData = yield api.getConnections(domain, config.environment);
			const { items } = normalizeRestArray(jsonData);
			const report = enrichRestLoadReport(
				loadRestArrayIntoStore(
					self.connections,
					ConnectionModel,
					items,
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

export { parseDockEndpointRef };
