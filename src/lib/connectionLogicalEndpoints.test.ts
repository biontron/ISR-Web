import { collectLogicalEndpointOptions, connectionTouchesGroup } from "./connectionLogicalEndpoints";
import { IAsset } from "../Stores/Models/Asset.Model";
import { IGroup } from "../Stores/Models/Group.Model";

describe("connectionLogicalEndpoints", () => {
	it("sammelt Device/Component und Groups", () => {
		const assets = [{ id: "a1", class: "Asset", definition: { name: "Server 32" } }] as IAsset[];
		const groups = [{ id: "g1", class: "Group", definition: { name: "VLAN Zone" } }] as IGroup[];
		const options = collectLogicalEndpointOptions(assets, groups);
		expect(options.map((entry) => entry.id)).toEqual(["a1", "g1"]);
	});

	it("erkennt Group-Endpunkte an der Connection", () => {
		expect(
			connectionTouchesGroup(
				{ links: [{ fromComponentRef: "a1", toComponentRef: "g1" }] },
				"g1"
			)
		).toBe(true);
	});
});
