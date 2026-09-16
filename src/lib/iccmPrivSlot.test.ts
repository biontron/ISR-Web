import {
	ICCM_PRIV_SLOT_MARKER,
	ICCM_PRIV_SLOT_SIZE,
	patchIccmPrivSlot,
	readIccmPrivSlotPem,
} from "./iccmPrivSlot";

function emptySlotBinary(): Uint8Array {
	const marker = new TextEncoder().encode(ICCM_PRIV_SLOT_MARKER);
	const binary = new Uint8Array(32 + ICCM_PRIV_SLOT_SIZE + 8);
	binary.fill(0x41, 0, 32);
	binary.fill(0x20, 32, 32 + ICCM_PRIV_SLOT_SIZE);
	binary.set(marker, 32);
	binary.fill(0x42, 32 + ICCM_PRIV_SLOT_SIZE);
	return binary;
}

describe("iccmPrivSlot", () => {
	it("patches PEM in place without changing length", () => {
		const original = emptySlotBinary();
		const pem = "-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----";
		const patched = patchIccmPrivSlot(original, pem);
		expect(patched.length).toBe(original.length);
		expect(readIccmPrivSlotPem(patched)).toContain("MIIB");
		const again = patchIccmPrivSlot(patched, "-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----");
		expect(again.length).toBe(original.length);
		expect(readIccmPrivSlotPem(again)).toContain("ABC");
		expect(readIccmPrivSlotPem(again)).not.toContain("MIIB");
	});

	it("reads nothing from an empty slot", () => {
		expect(readIccmPrivSlotPem(emptySlotBinary())).toBeNull();
	});
});
