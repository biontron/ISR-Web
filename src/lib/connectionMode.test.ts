import { resolveConnectionMode, canRefineConnection } from "./connectionMode";
import { IConnection } from "../Stores/Models/Connection.Model";

function connection(links: unknown[]): IConnection {
	return { id: "c1", definition: {}, links, settings: {} } as IConnection;
}

describe("connectionMode", () => {
	it("erkennt logische Verbindung ohne Dock und Linkparts", () => {
		const conn = connection([
			{
				id: "1",
				fromComponentRef: "a1",
				toComponentRef: "a2",
				fromDockRef: "",
				toDockRef: "",
				linkparts: [],
			} as any,
		]);
		expect(resolveConnectionMode(conn)).toBe("logical");
	});

	it("erkennt layered bei Linkparts und gleichen Asset-Refs", () => {
		const conn = connection([
			{
				id: "1",
				fromComponentRef: "a1",
				toComponentRef: "a2",
				fromDockRef: "d1#1",
				toDockRef: "d2#1",
				linkparts: [{ fromDockpartRef: "1", toDockpartRef: "2", stackOrder: 1 }],
			} as any,
			{
				id: "2",
				fromComponentRef: "a1",
				toComponentRef: "a2",
				fromDockRef: "d1#2",
				toDockRef: "d2#2",
				linkparts: [{ fromDockpartRef: "3", toDockpartRef: "4", stackOrder: 1 }],
			} as any,
		]);
		expect(resolveConnectionMode(conn)).toBe("layered");
	});

	it("erkennt stackPath bei unterschiedlichen fromComponentRef", () => {
		const conn = connection([
			{
				id: "1",
				fromComponentRef: "device",
				toComponentRef: "device-to",
				fromDockRef: "d1#1",
				toDockRef: "d2#1",
				linkparts: [],
			} as any,
			{
				id: "2",
				fromComponentRef: "os",
				toComponentRef: "os-to",
				fromDockRef: "d3#1",
				toDockRef: "d4#1",
				linkparts: [],
			} as any,
		]);
		expect(resolveConnectionMode(conn)).toBe("stackPath");
	});

	it("canRefineConnection erlaubt a→b und b→c", () => {
		const logical = connection([
			{ id: "1", fromComponentRef: "a1", toComponentRef: "a2", fromDockRef: "", toDockRef: "", linkparts: [] } as any,
		]);
		const layered = connection([
			{
				id: "1",
				fromComponentRef: "a1",
				toComponentRef: "a2",
				fromDockRef: "d1#1",
				toDockRef: "d2#1",
				linkparts: [{ fromDockpartRef: "1", toDockpartRef: "2", stackOrder: 1 }],
			} as any,
		]);

		expect(canRefineConnection(logical, "layered")).toBe(true);
		expect(canRefineConnection(logical, "stackPath")).toBe(true);
		expect(canRefineConnection(layered, "layered")).toBe(false);
		expect(canRefineConnection(layered, "stackPath")).toBe(true);
	});
});
