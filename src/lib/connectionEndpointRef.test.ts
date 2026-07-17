import {
	formatDockEndpointRef,
	parseDockEndpointRef,
	connectionTouchesAsset,
	connectionTouchesEndpoint,
	findAssetByEndpointRef,
	resolveConnectionEndpointSide,
	resolveEndpointLabelInfo,
} from "./connectionEndpointRef";

describe("connectionEndpointRef", () => {
	it("formatiert und parst dockId#dockpartId", () => {
		expect(formatDockEndpointRef("dock1", "part2")).toBe("dock1#part2");
		expect(parseDockEndpointRef("dock1#part2")).toEqual({
			dockId: "dock1",
			dockpartId: "part2",
		});
		expect(parseDockEndpointRef("invalid")).toBeUndefined();
	});

	it("connectionTouchesEndpoint prüft fromDockRef/toDockRef", () => {
		const connection = {
			id: "conn1",
			links: [
				{
					id: "1",
					title: "Link",
					fromDockRef: "d1#p1",
					toDockRef: "d2#p2",
					linkparts: [],
				},
			],
		} as any;

		expect(connectionTouchesEndpoint(connection, "d1#p1")).toBe(true);
		expect(connectionTouchesEndpoint(connection, "d2#p2")).toBe(true);
		expect(connectionTouchesEndpoint(connection, "d9#p9")).toBe(false);
	});

	it("findAssetByEndpointRef findet Asset über dock und dockpart", () => {
		const assets = [
			{
				id: "asset1",
				docks: [
					{
						id: "dockA",
						label: "Dock A",
						dockparts: [{ id: "7", label: "Part 7" }],
					},
				],
			},
		] as any;

		expect(findAssetByEndpointRef(assets, "dockA#7")?.id).toBe("asset1");
		expect(findAssetByEndpointRef(assets, "missing#7")).toBeUndefined();
	});

	it("resolveEndpointLabelInfo liefert Dock- und Dockpart-Label", () => {
		const assets = [
			{
				id: "asset1",
				docks: [
					{
						id: "dockA",
						label: "My Dock",
						dockparts: [{ id: "7", label: "HTTP Port" }],
					},
				],
			},
		] as any;

		expect(resolveEndpointLabelInfo(assets, "dockA#7")).toEqual({
			dockId: "dockA",
			dockpartId: "7",
			dockLabel: "My Dock",
			dockpartLabel: "HTTP Port",
		});
	});

	it("resolveConnectionEndpointSide liefert vollständige Seiten-Infos", () => {
		const assets = [
			{
				id: "asset1",
				definition: { name: "Server A", baseType: "server" },
				docks: [
					{
						id: "dockA",
						label: "My Dock",
						dockparts: [{ id: "7", label: "HTTP Port" }],
					},
				],
			},
		] as any;

		expect(resolveConnectionEndpointSide(assets, "dockA#7")).toEqual({
			ref: "dockA#7",
			dockId: "dockA",
			dockpartId: "7",
			dockLabel: "My Dock",
			dockpartLabel: "HTTP Port",
			assetId: "asset1",
			assetName: "Server A",
			assetBaseType: "server",
		});
	});

	it("connectionTouchesAsset erkennt Verbindungen über Element-Ref, Dock oder Linkparts", () => {
		const assetFrom = {
			id: "A-111",
			definition: { name: "From", baseType: "DEVICE" },
			docks: [
				{
					id: "D-FROM",
					label: "From Dock",
					dockparts: [{ id: "51", label: "TLS" }, { id: "62", label: "HTTP" }],
				},
			],
		} as any;
		const assetTo = {
			id: "A-222",
			definition: { name: "To", baseType: "DEVICE" },
			docks: [
				{
					id: "D-TO",
					label: "To Dock",
					dockparts: [{ id: "251", label: "TLS" }, { id: "262", label: "HTTP" }],
				},
			],
		} as any;

		const connection = {
			id: "C-1",
			links: [
				{
					id: "1",
					fromComponentRef: "A-111",
					toComponentRef: "A-222",
					fromDockRef: "D-FROM#51",
					toDockRef: "D-TO#251",
					linkparts: [
						{ fromDockpartRef: "62", toDockpartRef: "262", stackOrder: 0 },
					],
				},
			],
		} as any;

		expect(connectionTouchesAsset(connection, assetFrom)).toBe(true);
		expect(connectionTouchesAsset(connection, assetTo)).toBe(true);

		const connectionByLinkpartsOnly = {
			id: "C-2",
			links: [
				{
					id: "1",
					fromComponentRef: null,
					toComponentRef: null,
					fromDockRef: "legacy-dock#1",
					toDockRef: "other-dock#9",
					linkparts: [{ fromDockpartRef: "62", toDockpartRef: "262", stackOrder: 0 }],
				},
			],
		} as any;

		expect(connectionTouchesAsset(connectionByLinkpartsOnly, assetFrom)).toBe(true);
		expect(connectionTouchesAsset(connectionByLinkpartsOnly, assetTo)).toBe(true);

		const allAssets = [assetFrom, assetTo];
		expect(
			connectionTouchesAsset(connectionByLinkpartsOnly, assetFrom, allAssets)
		).toBe(true);
		expect(connectionTouchesAsset(connectionByLinkpartsOnly, assetTo, allAssets)).toBe(true);
	});
});
