import {
	STACK_INNER_PAD_X,
	STACK_INNER_PAD_Y,
} from "./graphComponentStack";
import { computeDeviceShellLayout } from "./graphComponentStackLayout";

describe("computeDeviceShellLayout", () => {
	it("umgibt Funktions-Components mit Titelleiste und Seitenabstand", () => {
		const layout = computeDeviceShellLayout(
			{ id: "device", width: 80, height: 30 },
			[
				{ memberIds: ["os"], widths: [100], heights: [24] },
				{ memberIds: ["app"], widths: [90], heights: [20] },
			],
			10,
			20
		);

		expect(layout.titleBarHeight).toBe(30);
		expect(layout.width).toBe(120);
		expect(layout.height).toBe(30 + STACK_INNER_PAD_Y + 24 + 20 + STACK_INNER_PAD_Y);

		const device = layout.positions.get("device");
		expect(device).toEqual({
			centerX: 10 + layout.width / 2,
			centerY: 20 + layout.height / 2,
			width: layout.width,
			height: layout.height,
		});

		const os = layout.positions.get("os");
		expect(os?.width).toBe(layout.width - STACK_INNER_PAD_X * 2);
		expect(os?.centerX).toBe(10 + STACK_INNER_PAD_X + os!.width / 2);
		expect(os?.centerY).toBe(20 + 30 + STACK_INNER_PAD_Y + 12);

		const app = layout.positions.get("app");
		expect(app?.centerY).toBe(20 + 30 + STACK_INNER_PAD_Y + 24 + 10);
	});

	it("wächst mit breiteren Funktions-Components plus Seitenabstand", () => {
		const layout = computeDeviceShellLayout(
			{ id: "device", width: 40, height: 20 },
			[{ memberIds: ["os"], widths: [200], heights: [16] }],
			0,
			0
		);
		expect(layout.width).toBe(200 + STACK_INNER_PAD_X * 2);
		expect(layout.positions.get("os")?.width).toBe(200);
	});
});
