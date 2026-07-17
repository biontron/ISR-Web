import { filterConnectionCandidates } from "./connectionCandidateFilter";

describe("connectionCandidateFilter", () => {
	const assets = [
		{
			id: "a-1",
			definition: {
				storeType: "COMPONENT",
				baseType: "COMPONENT",
				type: "DEVICE",
				subType: "SWITCH",
				name: "Switch-A",
			},
			docks: [
				{
					id: "d-1",
					dockparts: [{ id: "1", protocol: "IPv4", type: "", label: "" }],
				},
			],
		},
		{
			id: "a-2",
			definition: {
				storeType: "COMPONENT",
				baseType: "COMPONENT",
				type: "DEVICE",
				subType: "LIGHT",
				name: "Light-B",
			},
			docks: [
				{
					id: "d-2",
					dockparts: [{ id: "1", protocol: "Zigbee", type: "", label: "" }],
				},
			],
		},
		{
			id: "ws2",
			definition: {
				baseType: "HARDWARE",
				type: "",
				subType: "DESKTOP",
				name: "is-ws2",
			},
			docks: [],
		},
	] as any[];

	it("filtert nach elementType, subType, Suche und Protokoll", () => {
		expect(
			filterConnectionCandidates(assets, { elementType: "DEVICE", subType: "SWITCH" })
		).toHaveLength(1);
		expect(filterConnectionCandidates(assets, { searchText: "light" })).toHaveLength(1);
		expect(filterConnectionCandidates(assets, { protocol: "IPv4" })).toHaveLength(1);
	});

	it("löst Legacy-baseType als elementType auf", () => {
		expect(
			filterConnectionCandidates(assets, { elementType: "HARDWARE", subType: "DESKTOP" })
		).toEqual([assets[2]]);
	});
});
