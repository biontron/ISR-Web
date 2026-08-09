import { getEffectiveDocks } from "./effectiveDockparts";
import { buildValueReference, resolveValueReference } from "./valueReferenceResolve";
import { IDock } from "../Stores/Models/Dock.Model";
import { IAsset } from "../Stores/Models/Asset.Model";

function dock(id: string, parts: Array<{ id: string; type: string; protocol: string; settings?: Record<string, unknown> }>): IDock {
	return {
		id,
		type: "NETWORK",
		label: id,
		dockparts: parts.map((part) => ({
			id: part.id,
			type: part.type,
			protocol: part.protocol,
			label: part.type,
			basedOn: [],
			settings: new Map(Object.entries(part.settings ?? {})),
			schemaExtensions: new Map(),
		})),
	} as unknown as IDock;
}

describe("effectiveDockparts and value references", () => {
	it("resolveValueReference löst componentRef auf", () => {
		const vlanAsset = {
			id: "vlan",
			definition: { name: "VLAN-100", label: "VLAN-100" },
			docks: [],
		} as unknown as IAsset;
		const ref = buildValueReference("vlan");
		expect(resolveValueReference(ref, [vlanAsset])).toBe("VLAN-100");
	});

	it("getEffectiveDocks fügt geerbte Dockparts aus contextMemberships hinzu", () => {
		const contextAsset = {
			id: "ctx",
			definition: { name: "Network", label: "Network" },
			docks: [dock("dn", [{ id: "v1", type: "VLAN", protocol: "VLAN", settings: { vlan: "42" } }])],
		} as unknown as IAsset;

		const consumer = {
			id: "dev",
			definition: { name: "Device", label: "Device" },
			docks: [dock("dd", [{ id: "t1", type: "TCP", protocol: "TCP" }])],
			contextMemberships: [{ contextRef: "ctx", contextLabelSnapshot: "Network" }],
		} as unknown as IAsset;

		const effective = getEffectiveDocks(consumer, [contextAsset, consumer]);
		const inherited = effective.flatMap((entry) => entry.dockparts).find((part) => part.isInherited);
		expect(inherited?.protocol).toBe("VLAN");
		expect(inherited?.inheritedContextLabelSnapshot).toBe("Network");
	});
});
