import { buildSingleLinkSnapshot, collectStackLinkDrafts } from "./connectionStackTraversal";
import { resolveAssetStackChain } from "./connectionStackChain";
import { IDock } from "../Stores/Models/Dock.Model";
import { IAsset } from "../Stores/Models/Asset.Model";

function dock(id: string, parts: Array<{ id: string; type: string; protocol?: string; label?: string }>): IDock {
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
		})),
	} as unknown as IDock;
}

describe("connectionStackTraversal", () => {
	const fromAsset = {
		id: "from",
		definition: { name: "From App" },
		docks: [
			dock("dFrom", [
				{ id: "1", type: "GENERIC", label: "Generic" },
				{ id: "2", type: "HTTP", protocol: "HTTP", label: "HTTP" },
			]),
		],
	} as IAsset;

	const toAsset = {
		id: "to",
		definition: { name: "To App" },
		docks: [
			dock("dTo", [
				{ id: "10", type: "GENERIC", label: "Generic" },
				{ id: "20", type: "HTTP", protocol: "HTTP", label: "HTTP-Ziel" },
			]),
		],
	} as IAsset;

	const assets = [fromAsset, toAsset];

	it("buildSingleLinkSnapshot setzt AssetRefs und LabelSnapshots", () => {
		const snapshot = buildSingleLinkSnapshot(assets, {
			fromAssetId: "from",
			fromDockId: "dFrom",
			fromDockpartIds: ["2"],
			toAssetId: "to",
			toDockId: "dTo",
			toDockpartIds: ["20"],
		});
		expect(snapshot.fromComponentRef).toBe("from");
		expect(snapshot.toComponentRef).toBe("to");
		expect(snapshot.fromLabelSnapshot).toBe("From App");
		expect(snapshot.toLabelSnapshot).toBe("To App");
		expect(snapshot.linkparts).toHaveLength(1);
		expect(snapshot.linkparts[0].fromLabelSnapshot).toBe("HTTP");
	});

	it("collectStackLinkDrafts erzeugt Drafts je Stack-Ebene und Dock-Paar", () => {
		const fromChain = resolveAssetStackChain("from", assets);
		const toChain = resolveAssetStackChain("to", assets);
		const fromSelections = new Map([["from", ["dFrom"]]]);
		const toSelections = new Map([["to", ["dTo"]]]);
		const drafts = collectStackLinkDrafts(fromChain, toChain, fromSelections, toSelections);
		expect(drafts).toHaveLength(1);
		expect(drafts[0].fromAssetId).toBe("from");
	});
});
