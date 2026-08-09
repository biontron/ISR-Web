import { collectDockpartValueSnapshot, enrichBuiltLinkSnapshot } from "./connectionSnapshot";
import { buildSingleLinkSnapshot } from "./connectionStackTraversal";
import { IDock } from "../Stores/Models/Dock.Model";
import { IAsset } from "../Stores/Models/Asset.Model";

function dock(id: string, parts: Array<{ id: string; type: string; protocol?: string; label?: string; settings?: Record<string, unknown> }>): IDock {
	return {
		id,
		label: id,
		type: "GENERIC",
		dockparts: parts.map((part) => ({
			id: part.id,
			type: part.type,
			protocol: part.protocol ?? part.type,
			label: part.label ?? part.type,
			basedOn: [],
			settings: new Map(Object.entries(part.settings ?? {})),
			schemaExtensions: new Map(),
		})),
	} as unknown as IDock;
}

describe("connectionSnapshot", () => {
	it("collectDockpartValueSnapshot serialisiert settings", () => {
		const part = dock("d1", [{ id: "1", type: "VLAN", settings: { vlan: "100" } }]).dockparts[0];
		expect(collectDockpartValueSnapshot(part)).toEqual({ vlan: "100" });
	});

	it("buildSingleLinkSnapshot enthält Value- und Component-Snapshots", () => {
		const fromAsset = {
			id: "from",
			definition: { name: "From App", label: "From App" },
			docks: [
				dock("dFrom", [
					{ id: "2", type: "HTTP", protocol: "HTTP", label: "HTTP", settings: { port: "443" } },
				]),
			],
		} as unknown as IAsset;

		const toAsset = {
			id: "to",
			definition: { name: "To App", label: "To App" },
			docks: [
				dock("dTo", [
					{ id: "20", type: "HTTP", protocol: "HTTP", label: "HTTP-Ziel", settings: { port: "8443" } },
				]),
			],
		} as unknown as IAsset;

		const assets = [fromAsset, toAsset];
		const snapshot = buildSingleLinkSnapshot(assets, {
			fromAssetId: "from",
			fromDockId: "dFrom",
			fromDockpartIds: ["2"],
			toAssetId: "to",
			toDockId: "dTo",
			toDockpartIds: ["20"],
		});

		const enriched = enrichBuiltLinkSnapshot(assets, snapshot, "from", "to", "dFrom", "dTo");
		expect(enriched.fromComponentRefSnapshot?.id).toBe("from");
		expect(enriched.linkparts[0].fromValueSnapshot).toEqual({ port: "443" });
		expect(enriched.linkparts[0].toValueSnapshot).toEqual({ port: "8443" });
	});
});
