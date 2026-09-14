import {
	collectContextValues,
	findContextValue,
	isContextValueHost,
	matchingContextValuesForDockpart,
} from "./connectionContextValues";
import { formatValueRef } from "./connectionValueRef";

const host = {
	id: "ctx-a",
	docks: [
		{
			id: "d-ctx",
			type: "NET",
			label: "Netz",
			dockparts: [
				{ id: "v10", type: "VLAN", label: "VLAN 10", protocol: "VLAN" },
				{ id: "v20", type: "VLAN", label: "VLAN 20", protocol: "VLAN" },
				{ id: "net", type: "IP", label: "10.10.x.x", protocol: "IP" },
			],
		},
	],
};

describe("connectionContextValues", () => {
	it("sammelt mehrere VLAN-Werte eines Kontexts", () => {
		const values = collectContextValues(host);
		expect(values).toHaveLength(3);
		expect(values.map((value) => value.valueId)).toEqual(["v10", "v20", "net"]);
		expect(isContextValueHost(host)).toBe(true);
	});

	it("löst valueRef auf den konkreten Wert auf", () => {
		const found = findContextValue([host], formatValueRef("ctx-a", "v20"));
		expect(found?.label).toBe("VLAN 20");
		expect(findContextValue([host], "ctx-a#fehlt")).toBeUndefined();
	});

	it("filtert Werte nach Dockpart-Schicht", () => {
		const vlans = matchingContextValuesForDockpart([host], { type: "VLAN", protocol: "VLAN" });
		expect(vlans.map((value) => value.valueId)).toEqual(["v10", "v20"]);
	});
});
