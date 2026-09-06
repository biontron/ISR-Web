import { interpolateTitleTemplate } from "./titleTemplate";

describe("interpolateTitleTemplate", () => {
	it("füllt Felder aus dem Datenobjekt", () => {
		expect(
			interpolateTitleTemplate("Port {port}", { port: 443 }, "Settings")
		).toBe("Port 443");
		expect(
			interpolateTitleTemplate("#{id} {type} / {version} - {label}", {
				id: "3",
				type: "IP",
				version: "4",
				label: "LAN",
			}, "Definition")
		).toBe("#3 IP / 4 - LAN");
	});

	it("fällt auf den Gruppentitel zurück", () => {
		expect(interpolateTitleTemplate("", { port: 1 }, "Settings")).toBe("Settings");
		expect(interpolateTitleTemplate("{missing}", {}, "Settings")).toBe("Settings");
	});
});
