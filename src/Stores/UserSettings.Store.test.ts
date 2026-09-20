import { arrayBufferToPem } from "../lib/rsaPem";
import { mergeUserSettingsSnapshot } from "../lib/userSettingsSnapshot";

describe("mergeUserSettingsSnapshot", () => {
	const pem = {
		publicKey: arrayBufferToPem(new Uint8Array(200).fill(1).buffer, "PUBLIC KEY"),
		privateKey: arrayBufferToPem(new Uint8Array(200).fill(2).buffer, "PRIVATE KEY"),
	};
	const sent = {
		id: "1",
		name: "Mr. X",
		...pem,
	};

	it("keeps sent PEM when the server returns empty or geheim", () => {
		expect(mergeUserSettingsSnapshot({ id: "1", name: "Mr. X", publicKey: "", privateKey: "" }, sent)).toEqual(
			sent
		);
		expect(
			mergeUserSettingsSnapshot(
				{ id: "1", name: "Mr. X", publicKey: "geheim", privateKey: "geheim" },
				sent
			)
		).toEqual(sent);
	});

	it("takes a usable PEM from the server", () => {
		const stored = {
			id: "1",
			name: "Mr. X",
			publicKey: arrayBufferToPem(new Uint8Array(200).fill(3).buffer, "PUBLIC KEY"),
			privateKey: arrayBufferToPem(new Uint8Array(200).fill(4).buffer, "PRIVATE KEY"),
		};
		expect(mergeUserSettingsSnapshot(stored, emptyFallback())).toEqual(stored);
	});
});

function emptyFallback() {
	return { id: "", name: "", publicKey: "", privateKey: "" };
}
