import {
	buildStackDraftsFromActiveMatches,
	WizardDockpartMatch,
} from "./connectionWizardMatches";
import { resolveAssetStackAncestorChain } from "./connectionStackChain";
import { IAsset } from "../Stores/Models/Asset.Model";

function asset(id: string, ownerIdRef = "", name = id): IAsset {
	return {
		id,
		ownerIdRef,
		definition: { name, label: name },
		docks: [],
	} as unknown as IAsset;
}

describe("connectionWizardMatches stack drafts", () => {
	it("buildStackDraftsFromActiveMatches gruppiert nach Dock-Paar", () => {
		const matches: WizardDockpartMatch[] = [
			{
				matchKey: "HTTP",
				from: { assetId: "a1", dockId: "d1", dockpartId: "p1" },
				to: { assetId: "b1", dockId: "d2", dockpartId: "p2" },
			},
			{
				matchKey: "TCP",
				from: { assetId: "a1", dockId: "d1", dockpartId: "p3" },
				to: { assetId: "b1", dockId: "d2", dockpartId: "p4" },
			},
		];

		const drafts = buildStackDraftsFromActiveMatches(matches);
		expect(drafts).toHaveLength(1);
		expect(drafts[0].fromDockpartIds.sort()).toEqual(["p1", "p3"]);
		expect(drafts[0].toDockpartIds.sort()).toEqual(["p2", "p4"]);
	});

	it("buildStackDraftsFromActiveMatches erzeugt mehrere Drafts für mehrere Dock-Paare", () => {
		const matches: WizardDockpartMatch[] = [
			{
				matchKey: "HTTP",
				from: { assetId: "a1", dockId: "d1", dockpartId: "p1" },
				to: { assetId: "b1", dockId: "d2", dockpartId: "p2" },
			},
			{
				matchKey: "QUIC",
				from: { assetId: "a1", dockId: "d9", dockpartId: "p9" },
				to: { assetId: "b1", dockId: "d8", dockpartId: "p8" },
			},
		];

		expect(buildStackDraftsFromActiveMatches(matches)).toHaveLength(2);
	});
});

describe("resolveAssetStackAncestorChain", () => {
	it("liefert nur Vorfahren bis Anker ohne Nachfahren", () => {
		const assets = [asset("hw"), asset("os", "hw"), asset("app", "os"), asset("child", "app")];
		expect(resolveAssetStackAncestorChain("os", assets).map((entry) => entry.id)).toEqual([
			"hw",
			"os",
		]);
	});
});
