import {
	buildIccmHref,
	escapeXml,
	iccmConnectFetchPath,
	iccmConnectHandle,
	parseIccmConnectHandle,
	serializeFetchConnectXml,
	serializeLegacyConnectionXml,
	utf8ByteLength,
} from "./iccmConnectLink";

describe("iccmConnectLink", () => {
	it("serializes username and password from the link", () => {
		expect(
			serializeLegacyConnectionXml({
				label: "Webseite google.de",
				type: "browser",
				host: "google.com",
				port: 443,
				username: "Frank",
				password: "Freiheit",
				path: "/irgendwo",
				scheme: "https",
			})
		).toBe(
			"<connection><label>Webseite google.de</label><type>browser</type><host>google.com</host><port>443</port><username>Frank</username><password>Freiheit</password><path>/irgendwo</path><scheme>https</scheme></connection>"
		);
	});

	it("serializes the legacy enc payload like test_crypto.xqy", () => {
		expect(
			serializeLegacyConnectionXml({
				label: "Webseite google.de",
				type: "browser",
				host: "google.de",
				port: 443,
			})
		).toBe(
			"<connection><label>Webseite google.de</label><type>browser</type><host>google.de</host><port>443</port></connection>"
		);
	});

	it("serializes the fetch ticket like test_crypto.xqy", () => {
		const xml = serializeFetchConnectXml({
			server: "https://isr.biontron.com",
			url: "/api/demo/connect",
			accessToken: "abcdef1234",
			handleId: "T-abc4711",
			validTill: "2026-07-01T00:00:00Z",
		});
		expect(xml).toContain('server="https://isr.biontron.com"');
		expect(xml).toContain('url="/api/demo/connect"');
		expect(xml).toContain("<handles>");
		expect(xml).toContain('id="T-abc4711"');
		expect(utf8ByteLength(xml)).toBeLessThan(446);
	});

	it("builds iccm:// URLs with enc/fetch, ts and v=1", () => {
		expect(buildIccmHref("enc", "abc+/=", "2026-06-28T08:12:18Z")).toBe(
			"iccm://connect?enc=abc%2B%2F%3D&ts=2026-06-28T08%3A12%3A18Z&v=1"
		);
		expect(buildIccmHref("fetch", "xyz", "2026-06-28T08:12:18Z")).toContain("iccm://connect?fetch=");
	});

	it("maps the public API root to ICCM server+url", () => {
		expect(iccmConnectFetchPath("https://isr.biontron.com/api", "demo")).toEqual({
			server: "https://isr.biontron.com",
			url: "/api/demo/connect",
		});
	});

	it("roundtrips the fetch handle", () => {
		const handle = iccmConnectHandle(
			"4d722e2058",
			"01e93fa0-1c74-44b1-bafd-6d8a988fea01",
			"C-7Ad0yRZqg8pP9bEXyGq0sU"
		);
		expect(parseIccmConnectHandle(handle)).toEqual({
			usernameHex: "4d722e2058",
			environmentId: "01e93fa0-1c74-44b1-bafd-6d8a988fea01",
			connectionId: "C-7Ad0yRZqg8pP9bEXyGq0sU",
		});
	});

	it("escapes XML in attributes and text", () => {
		expect(escapeXml(`a<"&>`)).toBe("a&lt;&quot;&amp;&gt;");
	});
});
