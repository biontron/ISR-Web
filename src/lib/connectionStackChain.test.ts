import { alignStackChains, formatAssetChainPreview, resolveAssetStackChain } from "./connectionStackChain";
import { IAsset } from "../Stores/Models/Asset.Model";

function asset(id: string, ownerIdRef = "", name = id): IAsset {
	return {
		id,
		ownerIdRef,
		definition: { name },
		docks: [],
	} as unknown as IAsset;
}

describe("connectionStackChain", () => {
	const assets = [
		asset("hw", "", "Hardware"),
		asset("os", "hw", "OS"),
		asset("app", "os", "App"),
	];

	it("resolveAssetStackChain liefert Kette von Wurzel bis Anker und Nachfahren", () => {
		expect(resolveAssetStackChain("os", assets).map((entry) => entry.id)).toEqual(["hw", "os", "app"]);
	});

	it("alignStackChains nutzt kürzere Kette", () => {
		const short = [asset("a1"), asset("a2")];
		const long = [asset("b1"), asset("b2"), asset("b3")];
		expect(alignStackChains(short, long)).toBe(2);
	});

	it("formatAssetChainPreview zeigt Namen mit Pfeil", () => {
		expect(formatAssetChainPreview(resolveAssetStackChain("os", assets))).toBe("Hardware → OS → App");
	});
});
