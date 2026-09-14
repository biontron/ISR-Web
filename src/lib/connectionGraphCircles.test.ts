import { collectGraphDockCircles, renderGraphDockCirclesHtml } from "./connectionGraphCircles";
import { IAsset } from "../Stores/Models/Asset.Model";
import { LAYER_COLOR_VLAN } from "./connectionLayerColor";

function asset(id: string, ownerIdRef: string | null, docks: unknown[]): IAsset {
	return { id, ownerIdRef, class: "Asset", docks } as IAsset;
}

describe("connectionGraphCircles", () => {
	it("zeigt Kreise am Funktionsblock, nicht am Device-Kasten", () => {
		const device = asset("server-32", null, []);
		const web = asset("web", "server-32", [
			{
				id: "d1",
				dockparts: [{ id: "p1", type: "VLAN", label: "VLAN", valueRef: "ctx#v10" }],
			},
		]);
		const hosts = [
			{
				id: "ctx",
				docks: [
					{
						id: "cd",
						type: "",
						label: "",
						dockparts: [{ id: "v10", type: "VLAN", label: "VLAN 7" }],
					},
				],
			},
		];
		expect(collectGraphDockCircles(device, hosts)).toHaveLength(0);
		const circles = collectGraphDockCircles(web, hosts);
		expect(circles).toHaveLength(1);
		expect(circles[0].title).toBe("VLAN 7");
		expect(circles[0].color).toBe(LAYER_COLOR_VLAN);
		expect(renderGraphDockCirclesHtml(circles)).toContain("graph-dock-circle");
	});
});
