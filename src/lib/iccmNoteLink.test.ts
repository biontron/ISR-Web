import {
	collectAssetIccmPresets,
	formatIccmNoteSnippet,
	insertTextAtCursor,
	isSchemaCommentField,
	splitIccmNoteSegments,
} from "./iccmNoteLink";

describe("iccmNoteLink", () => {
	it("erkennt Notiz-Felder im SchemaEditor", () => {
		expect(isSchemaCommentField("note")).toBe(true);
		expect(isSchemaCommentField("notes")).toBe(true);
		expect(isSchemaCommentField("hostname")).toBe(false);
	});

	it("baut den Notiz-Snippet als XHTML mit Web-Link und ICCM-Link", () => {
		expect(
			formatIccmNoteSnippet(
				{
					label: "Web ic-ws2",
					type: "browser",
					host: "google.com",
					port: 443,
					path: "/irgendwo",
					scheme: "https",
				},
				"iccm://connect?enc=abc"
			)
		).toBe(
			'<p><a href="https://google.com/irgendwo">Web ic-ws2</a><br />\n<a href="iccm://connect?enc=abc">ICCM</a></p>'
		);
	});

	it("nutzt die Ziel-URL als Linktext wenn der Titel fehlt", () => {
		expect(
			formatIccmNoteSnippet(
				{
					label: "",
					type: "browser",
					host: "google.com",
					port: 443,
					path: "/irgendwo",
					scheme: "https",
				},
				"iccm://connect?enc=abc"
			)
		).toBe(
			'<p><a href="https://google.com/irgendwo">https://google.com/irgendwo</a><br />\n<a href="iccm://connect?enc=abc">ICCM</a></p>'
		);
	});

	it("fügt den Snippet an der Cursorposition ein", () => {
		expect(insertTextAtCursor("Hallo\nWelt", "LINK", 6, 6)).toEqual({
			next: "Hallo\nLINK\nWelt",
			cursor: 10,
		});
	});

	it("findet iccm://-Hrefs im Kommentartext", () => {
		expect(
			splitIccmNoteSegments("siehe iccm://connect?enc=abc%2B&ts=1&v=1 bitte")
		).toEqual([
			{ kind: "text", value: "siehe " },
			{ kind: "iccm", href: "iccm://connect?enc=abc%2B&ts=1&v=1" },
			{ kind: "text", value: " bitte" },
		]);
	});

	it("sammelt Dock-Presets nur aus HTTP/SSH/SCP", () => {
		const settings = (record: Record<string, string>) => new Map(Object.entries(record));
		const presets = collectAssetIccmPresets({
			id: "A-1",
			definition: { name: "box" },
			docks: [
				{
					id: "D-web",
					dockparts: [
						{
							id: "1",
							type: "HTTPS",
							protocol: "HTTPS",
							basedOn: [{ dockpartId: "2" }],
							settings: settings({ path: "/exist" }),
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
		});
		expect(presets).toHaveLength(1);
		expect(presets[0].target.host).toBe("ic-ws2.example.com");
		expect(presets[0].target.path).toBe("/exist");
	});
});
