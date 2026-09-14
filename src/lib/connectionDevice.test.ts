import {
	collectDeviceInnerComponents,
	isContextComponent,
	isDeviceBox,
	isDeviceComponent,
	isFunctionalComponent,
} from "./connectionDevice";
import { IAsset } from "../Stores/Models/Asset.Model";

function asset(
	id: string,
	extras: { ownerIdRef?: string | null; type?: string; docks?: unknown[] } = {}
): IAsset {
	return {
		id,
		ownerIdRef: extras.ownerIdRef ?? null,
		class: "Asset",
		definition: { type: extras.type ?? "COMPONENT", name: id },
		docks: extras.docks ?? [],
	} as IAsset;
}

describe("connectionDevice", () => {
	it("erkennt Device und Funktionsblöcke im Kasten", () => {
		const device = asset("server-4711", { type: "DEVICE" });
		const sip = asset("sip", { ownerIdRef: "server-4711", type: "APPLICATION" });
		const web = asset("webserver", { ownerIdRef: "server-4711", type: "APPLICATION" });
		const assets = [device, sip, web];

		expect(isDeviceComponent(device)).toBe(true);
		expect(isDeviceBox(device, assets)).toBe(true);
		expect(isFunctionalComponent(sip, assets)).toBe(true);
		expect(isFunctionalComponent(web, assets)).toBe(true);
		expect(collectDeviceInnerComponents(device, assets).map((item) => item.id)).toEqual([
			"sip",
			"webserver",
		]);
	});

	it("erkennt Context als Component mit VLAN-Dockparts", () => {
		const context = asset("vlan-zone", {
			type: "CONTEXT",
			docks: [
				{
					id: "d1",
					dockparts: [
						{ id: "v10", type: "VLAN", protocol: "VLAN", label: "VLAN 10" },
						{ id: "v20", type: "VLAN", protocol: "VLAN", label: "VLAN 20" },
					],
				},
			],
		});
		const device = asset("server-4711", { type: "DEVICE" });
		const assets = [context, device];
		expect(isContextComponent(context, assets)).toBe(true);
		expect(isContextComponent(device, assets)).toBe(false);
		expect(isDeviceComponent(context)).toBe(false);
	});

	it("hält Funktionsblöcke und Device mit VLAN-Docks vom Context fern", () => {
		const device = asset("server-4711", {
			type: "DEVICE",
			docks: [
				{
					id: "net",
					dockparts: [{ id: "eth0", type: "VLAN", protocol: "VLAN", label: "NIC" }],
				},
			],
		});
		const sip = asset("sip", {
			ownerIdRef: "server-4711",
			type: "APPLICATION",
			docks: [
				{
					id: "d-sip",
					dockparts: [{ id: "vlan", type: "VLAN", protocol: "VLAN", label: "SIP VLAN" }],
				},
			],
		});
		const assets = [device, sip];
		expect(isContextComponent(device, assets)).toBe(false);
		expect(isContextComponent(sip, assets)).toBe(false);
		expect(isFunctionalComponent(sip, assets)).toBe(true);
		expect(isDeviceBox(device, assets)).toBe(true);
	});
});
