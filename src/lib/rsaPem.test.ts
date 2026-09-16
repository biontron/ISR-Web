import { arrayBufferToPem } from "./rsaPem";

describe("rsaPem", () => {
	it("wraps bytes as PUBLIC KEY PEM", () => {
		const bytes = new Uint8Array([0, 1, 2, 3, 250]).buffer;
		const pem = arrayBufferToPem(bytes, "PUBLIC KEY");
		expect(pem.startsWith("-----BEGIN PUBLIC KEY-----\n")).toBe(true);
		expect(pem.includes("-----END PUBLIC KEY-----")).toBe(true);
	});

	it("wraps bytes as PRIVATE KEY PEM", () => {
		const bytes = new Uint8Array(80).fill(9).buffer;
		const pem = arrayBufferToPem(bytes, "PRIVATE KEY");
		expect(pem.startsWith("-----BEGIN PRIVATE KEY-----\n")).toBe(true);
		expect(pem.includes("-----END PRIVATE KEY-----")).toBe(true);
	});
});
