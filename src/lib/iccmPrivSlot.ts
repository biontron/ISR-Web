export const ICCM_PRIV_SLOT_MARKER = "ICCM-PRIV-SLOT-v1\n";
export const ICCM_PRIV_SLOT_SIZE = 8192;

function findBytes(haystack: Uint8Array, needle: Uint8Array): number {
	if (needle.length === 0 || needle.length > haystack.length) {
		return -1;
	}
	outer: for (let index = 0; index <= haystack.length - needle.length; index += 1) {
		for (let offset = 0; offset < needle.length; offset += 1) {
			if (haystack[index + offset] !== needle[offset]) {
				continue outer;
			}
		}
		return index;
	}
	return -1;
}

export function findIccmPrivSlot(binary: Uint8Array): number {
	return findBytes(binary, new TextEncoder().encode(ICCM_PRIV_SLOT_MARKER));
}

export function readIccmPrivSlotPem(binary: Uint8Array): string | null {
	const markerIndex = findIccmPrivSlot(binary);
	if (markerIndex < 0) {
		return null;
	}
	const markerBytes = new TextEncoder().encode(ICCM_PRIV_SLOT_MARKER);
	const payload = binary.subarray(markerIndex + markerBytes.length, markerIndex + ICCM_PRIV_SLOT_SIZE);
	const text = new TextDecoder().decode(payload);
	const start = text.indexOf("-----BEGIN PRIVATE KEY-----");
	const endTag = "-----END PRIVATE KEY-----";
	const end = text.indexOf(endTag);
	if (start < 0 || end < 0) {
		return null;
	}
	return text.slice(start, end + endTag.length).trim() + "\n";
}

export function patchIccmPrivSlot(binary: Uint8Array, pem: string): Uint8Array {
	const markerIndex = findIccmPrivSlot(binary);
	if (markerIndex < 0) {
		throw new Error("ICCM private-key slot not found");
	}
	const markerBytes = new TextEncoder().encode(ICCM_PRIV_SLOT_MARKER);
	const payloadStart = markerIndex + markerBytes.length;
	const payloadLength = ICCM_PRIV_SLOT_SIZE - markerBytes.length;
	const normalized = pem.trim() + "\n";
	const pemBytes = new TextEncoder().encode(normalized);
	if (pemBytes.length > payloadLength) {
		throw new Error("Private key does not fit into the ICCM slot");
	}
	const patched = new Uint8Array(binary);
	patched.fill(0x20, payloadStart, payloadStart + payloadLength);
	patched.set(pemBytes, payloadStart);
	return patched;
}
