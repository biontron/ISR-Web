import {
	buildDockpartDataPath,
	isDockpartDataPath,
	resolveDockpartDataPathPrefix,
} from "./dockpartDataPath";

describe("dockpartDataPath", () => {
	it("fügt settings für schema-Felder unter dockparts ein", () => {
		expect(buildDockpartDataPath("docks[0].dockparts[0]", "ip")).toBe(
			"docks[0].dockparts[0].settings.ip"
		);
		expect(buildDockpartDataPath("docks[1].dockparts[1]", "netmask")).toBe(
			"docks[1].dockparts[1].settings.netmask"
		);
	});

	it("belässt Kernfelder direkt unter dem Dockpart", () => {
		expect(buildDockpartDataPath("docks[0].dockparts[0]", "protocol")).toBe(
			"docks[0].dockparts[0].protocol"
		);
		expect(buildDockpartDataPath("docks[0].dockparts[0]", "label")).toBe(
			"docks[0].dockparts[0].label"
		);
	});

	it("ergänzt settings vor verschachtelten Gruppen ohne settings-Prefix", () => {
		expect(buildDockpartDataPath("docks[0].dockparts[0]", "address")).toBe(
			"docks[0].dockparts[0].settings.address"
		);
		expect(
			buildDockpartDataPath("docks[0].dockparts[0].address", "ip")
		).toBe("docks[0].dockparts[0].settings.address.ip");
		expect(
			buildDockpartDataPath("docks[1].dockparts[1].settings.address", "ip")
		).toBe("docks[1].dockparts[1].settings.address.ip");
	});

	it("resolveDockpartDataPathPrefix normalisiert bestehende Präfixe", () => {
		expect(resolveDockpartDataPathPrefix("docks[0].dockparts[0].address")).toBe(
			"docks[0].dockparts[0].settings.address"
		);
		expect(resolveDockpartDataPathPrefix("docks[0].dockparts[0].settings.address")).toBe(
			"docks[0].dockparts[0].settings.address"
		);
	});

	it("isDockpartDataPath erkennt Dockpart-Pfade", () => {
		expect(isDockpartDataPath("docks[0].dockparts[0].settings.address.ip")).toBe(true);
		expect(isDockpartDataPath("settings.address.ip")).toBe(false);
	});
});
