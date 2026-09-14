import { canDropAssetOnContextComponent, resolveContextBind } from "./connectionContextBind";
import { IAsset } from "../Stores/Models/Asset.Model";

function web(): IAsset {
	return {
		id: "web",
		definition: { type: "APPLICATION" },
		docks: [
			{
				id: "d1",
				dockparts: [{ id: "p-vlan", type: "VLAN", protocol: "VLAN", label: "VLAN" }],
			},
		],
	} as IAsset;
}

function context(valueIds: string[]): IAsset {
	return {
		id: "ctx",
		definition: { type: "CONTEXT" },
		docks: [
			{
				id: "cd",
				dockparts: valueIds.map((id) => ({ id, type: "VLAN", protocol: "VLAN", label: id })),
			},
		],
	} as IAsset;
}

describe("connectionContextBind", () => {
	it("bindet automatisch bei genau einem VLAN-Wert", () => {
		const result = resolveContextBind(web(), context(["v10"]));
		expect(result.status).toBe("ready");
		if (result.status === "ready") {
			expect(result.choice.toContextId).toBe("ctx");
			expect(result.choice.contextValueId).toBe("v10");
		}
	});

	it("fordert Auswahl bei mehreren VLAN-Werten", () => {
		const result = resolveContextBind(web(), context(["v10", "v20"]));
		expect(result.status).toBe("needs-choice");
		if (result.status === "needs-choice") {
			expect(result.matches).toHaveLength(2);
		}
	});

	it("erlaubt Drop nur von Device/Funktionsblock auf Context-Component", () => {
		const device = {
			id: "server-4711",
			definition: { type: "DEVICE" },
			docks: [],
		} as IAsset;
		const ctx = context(["v10"]);
		const otherCtx = context(["v11"]);
		otherCtx.id = "ctx-b";
		const assets = [device, ctx, otherCtx];
		expect(canDropAssetOnContextComponent(device, ctx, assets)).toBe(true);
		expect(canDropAssetOnContextComponent(ctx, otherCtx, assets)).toBe(false);
		expect(canDropAssetOnContextComponent(device, device, assets)).toBe(false);
	});
});
