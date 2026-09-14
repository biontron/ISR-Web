import { IAsset } from "../Stores/Models/Asset.Model";
import { IConnection, ILink } from "../Stores/Models/Connection.Model";
import {
	collectConnectionGraphEdges,
	collectRenderedGraphNodeIds,
} from "./graphConnectionEdges";

function asset(
	id: string,
	ownerIdRef: string | null = null,
	docks: Array<{ id: string; dockparts?: Array<{ id: string }> }> = []
): IAsset {
	return {
		id,
		ownerIdRef,
		definition: { name: id },
		docks: docks.map((dock) => ({
			id: dock.id,
			label: dock.id,
			type: "GENERIC",
			dockparts: (dock.dockparts ?? []).map((part) => ({
				id: part.id,
				type: "GENERIC",
				label: part.id,
			})),
		})),
	} as unknown as IAsset;
}

function link(partial: Partial<ILink> & { id: string }): ILink {
	return {
		title: "Link",
		fromComponentRef: null,
		fromDockRef: "",
		toComponentRef: null,
		toDockRef: "",
		direction: "DUAL",
		linkparts: [],
		...partial,
	} as ILink;
}

function connection(id: string, links: ILink[], kind: IConnection["kind"] = "link"): IConnection {
	return {
		id,
		kind,
		definition: { label: id },
		links,
	} as IConnection;
}

describe("graphConnectionEdges", () => {
	const deviceA = asset("device-a");
	const sipA = asset("sip-a", "device-a", [{ id: "dock-sip", dockparts: [{ id: "p-sip" }] }]);
	const deviceB = asset("device-b");
	const webB = asset("web-b", "device-b", [{ id: "dock-web", dockparts: [{ id: "p-web" }] }]);
	const assets = [deviceA, sipA, deviceB, webB];

	const sipToWeb = connection("conn-1", [
		link({
			id: "l1",
			fromComponentRef: "sip-a",
			fromDockRef: "dock-sip",
			toComponentRef: "web-b",
			toDockRef: "dock-web",
		}),
	]);

	it("zeichnet den Link zwischen inneren Stack-Components, wenn beide Knoten sichtbar sind", () => {
		const edges = collectConnectionGraphEdges(
			assets,
			[sipToWeb],
			new Set(["device-a", "sip-a", "device-b", "web-b"])
		);
		expect(edges).toEqual([
			expect.objectContaining({
				connectionId: "conn-1",
				fromNodeId: "sip-a",
				toNodeId: "web-b",
			}),
		]);
	});

	it("fällt auf das Device zurück, wenn nur die Basis-Kästen im Graphen sind", () => {
		const edges = collectConnectionGraphEdges(
			assets,
			[sipToWeb],
			new Set(["device-a", "device-b"])
		);
		expect(edges).toEqual([
			expect.objectContaining({
				connectionId: "conn-1",
				fromNodeId: "device-a",
				toNodeId: "device-b",
			}),
		]);
	});

	it("verwirft den Link nicht, nur weil der Tree die inneren Components nicht kennt", () => {
		const edges = collectConnectionGraphEdges(
			assets,
			[sipToWeb],
			new Set(["device-a", "device-b", "group-1"])
		);
		expect(edges).toHaveLength(1);
		expect(edges[0].fromNodeId).toBe("device-a");
		expect(edges[0].toNodeId).toBe("device-b");
	});

	it("verbindet zwei innere Ebenen desselben Devices, wenn beide Kästen sichtbar sind", () => {
		const osA = asset("os-a", "device-a");
		const intra = connection("conn-intra", [
			link({
				id: "l-intra",
				fromComponentRef: "sip-a",
				toComponentRef: "os-a",
			}),
		]);
		const edges = collectConnectionGraphEdges(
			[deviceA, sipA, osA],
			[intra],
			new Set(["device-a", "sip-a", "os-a"])
		);
		expect(edges).toEqual([
			expect.objectContaining({
				fromNodeId: "sip-a",
				toNodeId: "os-a",
			}),
		]);
	});

	it("zeichnet keinen Selbstloop, wenn beide Enden auf dasselbe sichtbare Device fallen", () => {
		const osA = asset("os-a", "device-a");
		const intra = connection("conn-intra", [
			link({
				id: "l-intra",
				fromComponentRef: "sip-a",
				toComponentRef: "os-a",
			}),
		]);
		const edges = collectConnectionGraphEdges(
			[deviceA, sipA, osA],
			[intra],
			new Set(["device-a"])
		);
		expect(edges).toEqual([]);
	});

	it("löst Dock-IDs ohne ComponentRef über das Asset mit diesem Dock auf", () => {
		const edges = collectConnectionGraphEdges(
			assets,
			[
				connection("conn-dock", [
					link({
						id: "l-dock",
						fromDockRef: "dock-sip",
						toDockRef: "dock-web",
					}),
				]),
			],
			new Set(["sip-a", "web-b"])
		);
		expect(edges).toEqual([
			expect.objectContaining({
				fromNodeId: "sip-a",
				toNodeId: "web-b",
			}),
		]);
	});

	it("collectRenderedGraphNodeIds lässt Utility-Knoten weg", () => {
		const ids = collectRenderedGraphNodeIds({
			nodes: () => [
				"device-a",
				"sip-a",
				"__stack__device-a",
				"__lane__net",
				"__lane__net__width-spacer",
				"__swimlanes_root__",
			],
		});
		expect(Array.from(ids).sort()).toEqual(["device-a", "sip-a"]);
	});
});
