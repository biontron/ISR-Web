import {
	collectAssetStackLayers,
	collectAssetStackLayersFromAssets,
	flattenAssetStackLayers,
	hasMultiLayerAssetStack,
	isAssetStackChildOf,
	isAssetStackRoot,
	resolveAssetStackRootId,
} from "./graphComponentStack";
import { TreeElement } from "../Interfaces/Element";
import { IAsset } from "../Stores/Models/Asset.Model";

function asset(id: string, ownerIdRef: string | null = null, name = id): IAsset {
	return {
		id,
		ownerIdRef,
		definition: { name },
	} as unknown as IAsset;
}

function treeAsset(id: string, ownerIdRef = "", name = id): TreeElement {
	return {
		id,
		class: "Asset",
		ownerIdRef,
		definition: { name },
		children() {
			return (this as { _children?: TreeElement[] })._children ?? [];
		},
	} as unknown as TreeElement;
}

function chainAssets(ids: string[]): TreeElement[] {
	const nodes = ids.map((id, index) => {
		const ownerIdRef = index === 0 ? "" : ids[index - 1];
		return treeAsset(id, ownerIdRef);
	});
	for (let i = 0; i < nodes.length - 1; i++) {
		(nodes[i] as unknown as { _children: TreeElement[] })._children = [nodes[i + 1]];
	}
	return nodes;
}

describe("graphComponentStack", () => {
	it("erkennt lineare Stapel-Ebenen im Tree", () => {
		const [hw, os, app] = chainAssets(["hw", "os", "app"]);
		expect(isAssetStackChildOf(hw, os)).toBe(true);
		expect(isAssetStackChildOf(os, app)).toBe(true);
		expect(collectAssetStackLayers(hw).map((layer) => layer.map((item) => item.id))).toEqual([
			["hw"],
			["os"],
			["app"],
		]);
		expect(hasMultiLayerAssetStack(collectAssetStackLayers(hw))).toBe(true);
	});

	it("erkennt Stapel aus flacher Asset-Liste", () => {
		const assets = [asset("hw", null), asset("os", "hw"), asset("app", "os")];
		expect(collectAssetStackLayersFromAssets(assets[0], assets).map((layer) => layer.map((item) => item.id))).toEqual([
			["hw"],
			["os"],
			["app"],
		]);
		expect(flattenAssetStackLayers(collectAssetStackLayersFromAssets(assets[0], assets)).map((item) => item.id)).toEqual([
			"hw",
			"os",
			"app",
		]);
	});

	it("erkennt parallele Container auf einer Ebene", () => {
		const hw = treeAsset("hw", "", "Hardware");
		const c1 = treeAsset("c1", "hw", "Container A");
		const c2 = treeAsset("c2", "hw", "Container B");
		(hw as unknown as { _children: TreeElement[] })._children = [c1, c2];

		expect(collectAssetStackLayers(hw).map((layer) => layer.map((item) => item.id))).toEqual([
			["hw"],
			["c1", "c2"],
		]);
	});

	it("resolveAssetStackRootId findet Wurzel", () => {
		const assets = [asset("hw", null), asset("os", "hw"), asset("app", "os")];
		expect(resolveAssetStackRootId("app", assets)).toBe("hw");
		expect(isAssetStackRoot(assets[0], assets)).toBe(true);
		expect(isAssetStackRoot(assets[1], assets)).toBe(false);
	});
});
