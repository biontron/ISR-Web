import { types } from "mobx-state-tree";
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

	it("liest Settings aus einer MST-Map", () => {
		const SettingsMap = types.map(types.frozen());
		const settings = SettingsMap.create({ ip: "192.168.1.1", netmask: "28" });
		expect(interpolateTitleTemplate("{ip}/{netmask}", settings, "Settings")).toBe(
			"192.168.1.1/28"
		);
	});

	it("löst JSON-Path und XPath relativ zum Dockpart auf", () => {
		const SettingsMap = types.map(types.frozen());
		const dockpart = {
			id: "3",
			type: "IP",
			settings: SettingsMap.create({ ip: "192.168.1.1", netmask: "28" }),
		};
		expect(
			interpolateTitleTemplate("{settings/ip}/{settings/netmask}", dockpart, "Settings")
		).toBe("192.168.1.1/28");
		expect(
			interpolateTitleTemplate("{settings.ip}/{settings.netmask}", dockpart, "Settings")
		).toBe("192.168.1.1/28");
		expect(
			interpolateTitleTemplate("{$.settings.ip}", dockpart, "Settings", { root: dockpart })
		).toBe("192.168.1.1");
	});

	it("löst {settings/ip} aus der Settings-Gruppe über den Elternknoten auf", () => {
		const SettingsMap = types.map(types.frozen());
		const element = {
			docks: [
				{
					dockparts: [
						{
							id: "3",
							type: "IP",
							settings: SettingsMap.create({ ip: "10.0.0.1", netmask: "24" }),
						},
					],
				},
			],
		};
		const settings = element.docks[0].dockparts[0].settings;
		expect(
			interpolateTitleTemplate("{settings/ip}/{settings/netmask}", settings, "Settings", {
				root: element,
				basePath: "docks[0].dockparts[0].settings",
			})
		).toBe("10.0.0.1/24");
		expect(
			interpolateTitleTemplate("{../type} {./ip}", settings, "Settings", {
				root: element,
				basePath: "docks[0].dockparts[0].settings",
			})
		).toBe("IP 10.0.0.1");
	});

	it("fällt auf den Gruppentitel zurück", () => {
		expect(interpolateTitleTemplate("", { port: 1 }, "Settings")).toBe("Settings");
		expect(interpolateTitleTemplate("{missing}", {}, "Settings")).toBe("Settings");
		expect(interpolateTitleTemplate("{ip}/{netmask}", {}, "Settings")).toBe("Settings");
		expect(interpolateTitleTemplate("{settings/ip}", {}, "Settings")).toBe("Settings");
	});
});
