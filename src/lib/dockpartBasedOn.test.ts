import {
	normalizeDockpartType,
	resolveAllowedLowerTypes,
	resolveBasedOnFromSiblings,
	sortSchemaIdsByStack,
	basedOnEntriesAreValid,
} from "./dockpartBasedOn";

const schemas = [
	{ id: "GENERIC", type: "GENERIC", parent: { whitelist: [] } },
	{ id: "ETHERNET", type: "ETHERNET", parent: { whitelist: ["GENERIC"] } },
	{ id: "VLAN", type: "VLAN", parent: { whitelist: ["ETHERNET", "GENERIC"] } },
	{ id: "IPV4", type: "IP", parent: { whitelist: ["VLAN", "ETHERNET", "GENERIC"] } },
	{ id: "TCP", type: "TCP", parent: { whitelist: ["IP", "GENERIC"] } },
	{ id: "ICMP", type: "ICMP", parent: { whitelist: ["IP", "GENERIC"] } },
	{ id: "DNS", type: "DNS", parent: { whitelist: ["IP", "GENERIC"] } },
	{ id: "HTTP", type: "HTTP", parent: { whitelist: ["TCP", "QUICK", "GENERIC"] } },
];

describe("dockpartBasedOn", () => {
	it("normalisiert IPv4/IPv6 auf IP", () => {
		expect(normalizeDockpartType("IPv4")).toBe("IP");
		expect(normalizeDockpartType("ipv6")).toBe("IP");
		expect(normalizeDockpartType("TCP")).toBe("TCP");
	});

	it("nimmt parent.whitelist aus dem Schema", () => {
		expect(resolveAllowedLowerTypes("TCP", schemas)).toEqual(["IP", "GENERIC"]);
		expect(resolveAllowedLowerTypes("ICMP", schemas)).toEqual(["IP", "GENERIC"]);
		expect(resolveAllowedLowerTypes("DNS", schemas)).toEqual(["IP", "GENERIC"]);
	});

	it("füllt basedOn mit der nächsten darunterliegenden Schicht", () => {
		const siblings = [
			{ id: "1", type: "VLAN" },
			{ id: "3", type: "IP" },
		];
		expect(resolveBasedOnFromSiblings("TCP", siblings, schemas, "2")).toEqual([
			{ dockpartId: "3" },
		]);
		expect(resolveBasedOnFromSiblings("IP", siblings, schemas, "3")).toEqual([
			{ dockpartId: "1" },
		]);
		expect(resolveBasedOnFromSiblings("DNS", siblings, schemas, "4")).toEqual([
			{ dockpartId: "3" },
		]);
		expect(resolveBasedOnFromSiblings("ICMP", siblings, schemas, "5")).toEqual([
			{ dockpartId: "3" },
		]);
	});

	it("fällt auf Ethernet zurück wenn kein VLAN da ist", () => {
		const siblings = [{ id: "1", type: "ETHERNET" }];
		expect(resolveBasedOnFromSiblings("IP", siblings, schemas)).toEqual([
			{ dockpartId: "1" },
		]);
	});

	it("sortiert Anlage-Typen von unten nach oben", () => {
		expect(sortSchemaIdsByStack(["HTTP", "TCP", "IPV4", "VLAN"], schemas)).toEqual([
			"VLAN",
			"IPV4",
			"TCP",
			"HTTP",
		]);
	});

	it("erkennt gültige basedOn-Referenzen", () => {
		const siblings = [
			{ id: "1", type: "IP" },
			{ id: "2", type: "TCP" },
		];
		expect(basedOnEntriesAreValid([{ dockpartId: "1" }], siblings, "2")).toBe(true);
		expect(basedOnEntriesAreValid([{ dockpartId: "9" }], siblings, "2")).toBe(false);
		expect(basedOnEntriesAreValid([], siblings, "2")).toBe(false);
	});
});
