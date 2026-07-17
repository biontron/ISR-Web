import {
	connectionUriSidesForDirection,
	normalizeConnectionDirection,
	resolveConnectionDirection,
	resolveConnectionDirectionMarkers,
} from "./connectionDirection";

describe("connectionDirection", () => {
	it("normalizes legacy directions", () => {
		expect(normalizeConnectionDirection("FROM_TO")).toBe("OUT");
		expect(normalizeConnectionDirection("TO_FROM")).toBe("IN");
	});

	it("resolves markers for DUAL and LOGICAL", () => {
		expect(resolveConnectionDirectionMarkers("DUAL", "a-start", "a-end")).toEqual({
			markerStart: "url(#a-start)",
			markerEnd: "url(#a-end)",
		});
		expect(resolveConnectionDirectionMarkers("LOGICAL", "a-start", "a-end")).toEqual({
			strokeDasharray: "6 4",
		});
	});

	it("maps URI sides", () => {
		expect(connectionUriSidesForDirection("OUT")).toEqual({ from: true, to: false });
		expect(connectionUriSidesForDirection("LOGICAL")).toEqual({ from: false, to: false });
	});

	it("falls back to DUAL for unknown values", () => {
		expect(resolveConnectionDirection("FROM_TO")).toBe("OUT");
		expect(resolveConnectionDirection("unknown")).toBe("DUAL");
	});
});
