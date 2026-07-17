import {
	collectWizardDockpartMatches,
	dockpartLocatorKey,
	isDockpartSelected,
	resolveActiveWizardMatches,
	toggleDockpartSelection,
} from "./connectionWizardMatches";
import { IAsset } from "../Stores/Models/Asset.Model";

function asset(id: string, docks: unknown[]): IAsset {
	return { id, docks } as IAsset;
}

describe("connectionWizardMatches", () => {
	const fromAsset = asset("from", [
		{
			id: "d1",
			dockparts: [
				{ id: "p1", protocol: "HTTP", type: "HTTP", label: "HTTP" },
				{ id: "p2", protocol: "TLS", type: "TLS", label: "TLS" },
			],
		},
	]);
	const toAsset = asset("to", [
		{
			id: "d2",
			dockparts: [{ id: "t1", protocol: "HTTP", type: "HTTP", label: "HTTP-Ziel" }],
		},
	]);

	it("findet protokollgleiche Matches über beide Seiten", () => {
		const matches = collectWizardDockpartMatches([fromAsset], [toAsset]);
		expect(matches).toHaveLength(1);
		expect(matches[0].matchKey).toBe("HTTP");
	});

	it("aktiviert Pairings nur wenn beide Dockparts selektiert sind", () => {
		const matches = collectWizardDockpartMatches([fromAsset], [toAsset]);
		const from = { assetId: "from", dockId: "d1", dockpartId: "p1" };
		const to = { assetId: "to", dockId: "d2", dockpartId: "t1" };
		expect(resolveActiveWizardMatches(matches, [from], [])).toHaveLength(0);
		expect(resolveActiveWizardMatches(matches, [from], [to])).toHaveLength(1);
	});

	it("toggleDockpartSelection", () => {
		const locator = { assetId: "from", dockId: "d1", dockpartId: "p1" };
		const next = toggleDockpartSelection([], locator, true);
		expect(isDockpartSelected(next, locator)).toBe(true);
		expect(dockpartLocatorKey(locator)).toBe("from:d1:p1");
	});
});
