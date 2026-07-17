import {
	collectMatchKeysFromSelection,
	dockpartMatchKey,
	filterCompatibleTargetAssets,
	canOpenConnectionSelectionDialog,
	hasAnyCompatibleTargetAsset,
	pairSelectedDockparts,
	sortDockpartsByBasedOn,
	topDockpartIdFromSelection,
} from "./connectionDockpartPairing";
import { IDock } from "../Stores/Models/Dock.Model";

function makeDock(id: string, dockparts: unknown[]): IDock {
	return {
		id,
		label: id,
		type: "GENERIC",
		dockparts,
	} as IDock;
}

describe("connectionDockpartPairing", () => {
	const webDock = makeDock("dockWeb", [
		{ id: "1", type: "GENERIC", protocol: "", label: "Generic", basedOn: [] },
		{ id: "2", type: "TCP", protocol: "TCP", label: "TCP", basedOn: [{ dockpartId: "1" }] },
		{ id: "3", type: "TLS", protocol: "TLS", label: "TLS", basedOn: [{ dockpartId: "2" }] },
		{ id: "4", type: "HTTP", protocol: "HTTP", label: "HTTP", basedOn: [{ dockpartId: "3" }] },
	]);

	it("dockpartMatchKey bevorzugt protocol vor type", () => {
		expect(dockpartMatchKey({ protocol: "HTTP", type: "HTTP" } as any)).toBe("HTTP");
		expect(dockpartMatchKey({ protocol: "", type: "GENERIC" } as any)).toBe("GENERIC");
	});

	it("sortiert selektierte Dockparts nach basedOn", () => {
		expect(sortDockpartsByBasedOn(webDock, ["4", "3", "2"])).toEqual(["2", "3", "4"]);
		expect(topDockpartIdFromSelection(webDock, ["4", "3"])).toBe("4");
	});

	it("filtert kompatible Ziel-Assets nach Match-Keys", () => {
		const currentAsset = {
			id: "a1",
			docks: [webDock],
		} as any;
		const compatible = {
			id: "a2",
			docks: [
				makeDock("dockB", [
					{ id: "10", type: "HTTP", protocol: "HTTP", label: "HTTP", basedOn: [] },
				]),
			],
		} as any;
		const incompatible = {
			id: "a3",
			docks: [
				makeDock("dockC", [
					{ id: "20", type: "MQTT", protocol: "MQTT", label: "MQTT", basedOn: [] },
				]),
			],
		} as any;

		const selection = [{ dockId: "dockWeb", dockpartId: "4" }];
		expect(filterCompatibleTargetAssets([currentAsset, compatible, incompatible], currentAsset, selection)).toEqual([
			compatible,
		]);
		expect(hasAnyCompatibleTargetAsset([currentAsset, compatible, incompatible], currentAsset)).toBe(true);
	});

	it("paart Dockparts nach Protokoll und stackOrder", () => {
		const fromDock = webDock;
		const toDock = makeDock("dockTarget", [
			{ id: "t2", type: "TLS", protocol: "TLS", label: "TLS-Ziel", basedOn: [] },
			{ id: "t4", type: "HTTP", protocol: "HTTP", label: "HTTP-Ziel", basedOn: [{ dockpartId: "t2" }] },
		]);

		const result = pairSelectedDockparts(fromDock, ["3", "4"], toDock, ["t2", "t4"]);
		expect(result.unmatchedFromKeys).toEqual([]);
		expect(result.linkparts).toEqual([
			{
				fromLabelSnapshot: "TLS",
				toLabelSnapshot: "TLS-Ziel",
				fromDockpartRef: "3",
				toDockpartRef: "t2",
				stackOrder: 1,
			},
			{
				fromLabelSnapshot: "HTTP",
				toLabelSnapshot: "HTTP-Ziel",
				fromDockpartRef: "4",
				toDockpartRef: "t4",
				stackOrder: 2,
			},
		]);
	});

	it("erzeugt nur gematchte Linkparts bei partieller Selektion", () => {
		const toDock = makeDock("dockTarget", [
			{ id: "t4", type: "HTTP", protocol: "HTTP", label: "HTTP-Ziel", basedOn: [] },
		]);
		const result = pairSelectedDockparts(webDock, ["3", "4"], toDock, ["t4"]);
		expect(result.linkparts).toHaveLength(1);
		expect(result.linkparts[0].fromDockpartRef).toBe("4");
		expect(result.unmatchedFromKeys).toEqual(["TLS"]);
	});

	it("canOpenConnectionSelectionDialog erlaubt Wizard ohne eigene Dockparts", () => {
		const newAsset = { id: "new", docks: [] } as any;
		const compatible = {
			id: "a2",
			docks: [
				makeDock("dockB", [
					{ id: "10", type: "HTTP", protocol: "HTTP", label: "HTTP", basedOn: [] },
				]),
			],
		} as any;

		expect(hasAnyCompatibleTargetAsset([newAsset, compatible], newAsset)).toBe(false);
		expect(canOpenConnectionSelectionDialog([newAsset, compatible], newAsset)).toBe(true);
		expect(canOpenConnectionSelectionDialog([newAsset], newAsset)).toBe(false);
	});

	it("collectMatchKeysFromSelection", () => {
		const asset = { id: "a1", docks: [webDock] } as any;
		expect(
			Array.from(
				collectMatchKeysFromSelection(asset, [{ dockId: "dockWeb", dockpartId: "4" }])
			)
		).toEqual(["HTTP"]);
	});
});
