import { LAYER_COLOR_DEFAULT, LAYER_COLOR_IP, LAYER_COLOR_VLAN, connectionLayerColor } from "./connectionLayerColor";

describe("connectionLayerColor", () => {
	it("färbt VLAN rot und IP lila", () => {
		expect(connectionLayerColor("VLAN")).toBe(LAYER_COLOR_VLAN);
		expect(connectionLayerColor("IP")).toBe(LAYER_COLOR_IP);
		expect(connectionLayerColor("HTTP")).toBe(LAYER_COLOR_DEFAULT);
	});
});
