import { getEffectiveDocks } from "./effectiveDockparts";
import {
	buildContextValueReference,
	resolveValueReference,
} from "./valueReferenceResolve";
import { IGroup } from "../Stores/Models/Group.Model";
import { IAsset } from "../Stores/Models/Asset.Model";

describe("effectiveDockparts and context value references", () => {
	it("resolveValueReference löst contextValueRef aus Group.settings auf", () => {
		const vlanGroup = {
			id: "vlan-group",
			definition: { name: "VLAN-100", label: "VLAN-100" },
			settings: new Map([["vlanId", "100"]]),
		} as unknown as IGroup;

		const ref = buildContextValueReference("vlan-group", "vlanId", "VLAN-100");
		expect(resolveValueReference(ref, { groups: [vlanGroup] })).toBe("100");
	});

	it("getEffectiveDocks löst contextValueRef in Dockpart-Settings auf, ohne extra Dockparts", () => {
		const vlanGroup = {
			id: "vlan-group",
			definition: { name: "VLAN-100", label: "VLAN-100" },
			settings: new Map([["vlanId", "100"]]),
		} as unknown as IGroup;

		const device = {
			id: "dev",
			definition: { name: "Device", label: "Device" },
			contextMemberships: [{ contextGroupRef: "vlan-group", contextLabelSnapshot: "VLAN-100" }],
			docks: [
				{
					id: "d1",
					type: "NETWORK",
					label: "net",
					dockparts: [
						{
							id: "p1",
							type: "VLAN",
							protocol: "VLAN",
							label: "VLAN",
							basedOn: [],
							settings: new Map([
								[
									"vlanId",
									buildContextValueReference("vlan-group", "vlanId"),
								],
							]),
							schemaExtensions: new Map(),
						},
					],
				},
			],
		} as unknown as IAsset;

		const effective = getEffectiveDocks(device, [device], [vlanGroup]);
		expect(effective).toHaveLength(1);
		expect(effective[0].dockparts).toHaveLength(1);
		expect(effective[0].dockparts[0].settings.get("vlanId")).toBe("100");
	});
});
