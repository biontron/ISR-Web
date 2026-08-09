import { resolveDockpartLayerStack } from "./dockpartStackResolve";
import { IDock } from "../Stores/Models/Dock.Model";
import { IAsset } from "../Stores/Models/Asset.Model";

function dock(id: string, parts: Array<{ id: string; type: string; protocol: string; basedOn?: Array<{ dockpartId?: string; componentRef?: string; externalDockpartRef?: string }> }>): IDock {
	return {
		id,
		type: "GENERIC",
		label: id,
		dockparts: parts.map((part) => ({
			id: part.id,
			type: part.type,
			protocol: part.protocol,
			label: part.type,
			basedOn: part.basedOn ?? [],
		})),
	} as unknown as IDock;
}

describe("dockpartStackResolve", () => {
	it("löst lokale basedOn-Kette auf", () => {
		const asset = {
			id: "a1",
			docks: [
				dock("d1", [
					{ id: "1", type: "IP", protocol: "IP" },
					{ id: "2", type: "TCP", protocol: "TCP", basedOn: [{ dockpartId: "1" }] },
					{ id: "3", type: "HTTP", protocol: "HTTP", basedOn: [{ dockpartId: "2" }] },
				]),
			],
		} as unknown as IAsset;

		const httpPart = asset.docks[0].dockparts[2];
		const stack = resolveDockpartLayerStack(httpPart, asset, asset.docks[0], [asset]);
		expect(stack.map((layer) => layer.dockpart.protocol)).toEqual(["IP", "TCP", "HTTP"]);
	});

	it("löst cross-component externalDockpartRef auf", () => {
		const networkAsset = {
			id: "net",
			docks: [dock("dn", [{ id: "vlan1", type: "VLAN", protocol: "VLAN" }])],
		} as unknown as IAsset;
		const deviceAsset = {
			id: "dev",
			docks: [
				dock("dd", [
					{
						id: "tcp1",
						type: "TCP",
						protocol: "TCP",
						basedOn: [{ externalDockpartRef: "dn#vlan1" }],
					},
				]),
			],
		} as unknown as IAsset;

		const assets = [networkAsset, deviceAsset];
		const tcpPart = deviceAsset.docks[0].dockparts[0];
		const stack = resolveDockpartLayerStack(tcpPart, deviceAsset, deviceAsset.docks[0], assets);
		expect(stack.map((layer) => layer.dockpart.protocol)).toEqual(["VLAN", "TCP"]);
	});
});
