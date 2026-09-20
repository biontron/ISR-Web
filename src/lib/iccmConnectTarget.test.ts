import {
	buildIccmTargetUrl,
	readLinkCredentials,
	resolveAssetConnectTarget,
	resolveConnectionConnectTarget,
	resolveConnectionSideTarget,
} from "./iccmConnectTarget";

function settings(record: Record<string, string>) {
	return new Map(Object.entries(record));
}

function routerAsset() {
	return {
		id: "A-router",
		definition: { name: "is-router1", label: "is-router1" },
		docks: [
			{
				id: "D-net",
				hints: [{ value: "is-router1.example.com" }],
				dockparts: [
					{
						id: "2",
						type: "TCP",
						protocol: "TCP",
						basedOn: [{ dockpartId: "3" }],
						settings: settings({}),
					},
					{
						id: "3",
						type: "IP",
						protocol: "IP",
						basedOn: [{ dockpartId: "4" }],
						settings: settings({ ip: "192.168.1.1" }),
					},
					{
						id: "4",
						type: "DNS",
						protocol: "DNS",
						settings: settings({ hostname: "is-router1.example.com" }),
					},
					{
						id: "5",
						type: "HTTPS",
						protocol: "HTTPS",
						basedOn: [{ dockpartId: "2" }],
						settings: settings({}),
					},
				],
			},
		],
	};
}

describe("iccmConnectTarget", () => {
	it("walks basedOn to host and HTTPS type", () => {
		const target = resolveAssetConnectTarget(routerAsset(), "D-net", "5");
		expect(target).toEqual({
			label: "is-router1",
			type: "browser",
			host: "is-router1.example.com",
			port: 443,
			path: undefined,
			scheme: "https",
		});
	});

	it("uses a dock hint when docks have no host", () => {
		const asset = {
			id: "A-empty",
			definition: { name: "bare", label: "bare" },
			docks: [
				{
					id: "D-1",
					hints: [{ value: "hint.example.com" }],
					dockparts: [{ id: "1", type: "TCP", protocol: "TCP", settings: settings({}) }],
				},
			],
		};
		expect(resolveAssetConnectTarget(asset)?.host).toBe("hint.example.com");
	});

	it("maps SCP with username and path", () => {
		const asset = {
			id: "A-scp",
			definition: { name: "ic-ws2-access", label: "ic-ws2 Remote Access" },
			docks: [
				{
					id: "D-scp",
					dockparts: [
						{
							id: "1",
							type: "SCP",
							protocol: "SCP",
							basedOn: [{ dockpartId: "2" }],
							settings: settings({ username: "admin", path: "/home/admin" }),
						},
						{
							id: "2",
							type: "TCP",
							protocol: "TCP",
							basedOn: [{ dockpartId: "3" }],
							settings: settings({ port: "22" }),
						},
						{
							id: "3",
							type: "DNS",
							protocol: "DNS",
							settings: settings({ hostname: "ic-ws2.example.com" }),
						},
					],
				},
			],
		};
		expect(resolveAssetConnectTarget(asset, "D-scp", "1")).toEqual({
			label: "ic-ws2-access",
			type: "scp",
			host: "ic-ws2.example.com",
			port: 22,
			path: "/home/admin",
			scheme: "scp",
		});
	});

	it("resolves the to-side of a component connection", () => {
		const connection = {
			links: [
				{
					fromComponentRef: "A-other",
					fromDockRef: "D-x",
					toComponentRef: "A-router",
					toDockRef: "D-net#5",
					linkparts: [{ fromDockpartRef: "1", toDockpartRef: "5" }],
				},
			],
		};
		expect(resolveConnectionSideTarget(connection, [routerAsset()], "to")?.host).toBe(
			"is-router1.example.com"
		);
		expect(resolveConnectionConnectTarget(connection, [routerAsset()])?.host).toBe(
			"is-router1.example.com"
		);
	});

	it("builds https://host/path from the to-dock", () => {
		const asset = {
			id: "A-web",
			definition: { name: "google", label: "google" },
			docks: [
				{
					id: "D-web",
					dockparts: [
						{
							id: "1",
							type: "HTTPS",
							protocol: "HTTPS",
							basedOn: [{ dockpartId: "2" }],
							settings: settings({ path: "/irgendwo" }),
						},
						{
							id: "2",
							type: "DNS",
							protocol: "DNS",
							settings: settings({ hostname: "google.com" }),
						},
					],
				},
			],
		};
		const connection = {
			links: [
				{
					fromComponentRef: "A-client",
					fromDockRef: "D-cli#1",
					toComponentRef: "A-web",
					toDockRef: "D-web#1",
					direction: "OUT",
					linkparts: [{ fromDockpartRef: "1", toDockpartRef: "1" }],
					credentials: [{ username: "Frank", password: "Freiheit" }],
				},
			],
		};
		const target = resolveConnectionConnectTarget(connection, [asset]);
		expect(target).toMatchObject({
			host: "google.com",
			path: "/irgendwo",
			scheme: "https",
			username: "Frank",
			password: "Freiheit",
		});
		expect(buildIccmTargetUrl(target!)).toBe("https://google.com/irgendwo");
	});

	it("takes Frank:Freiheit from link credentials, not from the dock", () => {
		expect(readLinkCredentials([{ username: "Frank", password: "Freiheit" }])).toEqual({
			username: "Frank",
			password: "Freiheit",
		});
		expect(readLinkCredentials([{ value: "Frank:Freiheit" }])).toEqual({
			username: "Frank",
			password: "Freiheit",
		});
		const asset = {
			id: "A-ssh",
			definition: { name: "ic-ws2", label: "ic-ws2" },
			docks: [
				{
					id: "D-ssh",
					dockparts: [
						{
							id: "1",
							type: "SSH",
							protocol: "SSH",
							basedOn: [{ dockpartId: "2" }],
							settings: settings({ username: "admin" }),
						},
						{
							id: "2",
							type: "DNS",
							protocol: "DNS",
							settings: settings({ hostname: "ic-ws2.example.com" }),
						},
					],
				},
			],
		};
		const connection = {
			links: [
				{
					fromComponentRef: "A-client",
					fromDockRef: "D-cli#2",
					toComponentRef: "A-ssh",
					toDockRef: "D-ssh#1",
					direction: "OUT",
					linkparts: [{ fromDockpartRef: "2", toDockpartRef: "1" }],
					credentials: [{ username: "Frank", password: "Freiheit" }],
				},
			],
		};
		expect(resolveConnectionConnectTarget(connection, [asset])).toMatchObject({
			host: "ic-ws2.example.com",
			username: "Frank",
			password: "Freiheit",
		});
	});
});
