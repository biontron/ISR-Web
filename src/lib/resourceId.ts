import { v4 as uuidv4 } from "uuid";

/** Zielmuster: [VGADCE]-[A-Za-z0-9]{22} — verlustfreie UUID-v4-Kompression in Base62. */
export const RESOURCE_ID_REGEX = /^[VGADCE]-[A-Za-z0-9]{22}$/;

export const RESOURCE_ID_SUFFIX_LENGTH = 22;

const BASE62_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE62_RADIX = 62;

export type ResourceType =
	| "View"
	| "Group"
	| "Asset"
	| "Dock"
	| "Connection"
	| "Environment";

const RESOURCE_TYPE_PREFIX: Record<ResourceType, string> = {
	View: "V",
	Group: "G",
	Asset: "A",
	Dock: "D",
	Connection: "C",
	Environment: "E",
};

function uuidStringToBytes(uuid: string): number[] {
	const hex = uuid.replace(/-/g, "");
	const bytes: number[] = [];
	for (let index = 0; index < hex.length; index += 2) {
		bytes.push(parseInt(hex.slice(index, index + 2), 16));
	}
	return bytes;
}

/** 128-Bit-Bytefolge → exakt 22 Base62-Zeichen (verlustfrei). */
export function encodeBytesToBase62(bytes: number[], length = RESOURCE_ID_SUFFIX_LENGTH): string {
	let digits = bytes.slice();
	let encoded = "";

	while (digits.some((digit) => digit !== 0)) {
		let remainder = 0;
		const nextDigits: number[] = [];
		for (let index = 0; index < digits.length; index += 1) {
			const value = remainder * 256 + digits[index];
			const quotient = Math.floor(value / BASE62_RADIX);
			remainder = value % BASE62_RADIX;
			if (nextDigits.length > 0 || quotient > 0) {
				nextDigits.push(quotient);
			}
		}
		encoded = BASE62_CHARSET[remainder] + encoded;
		digits = nextDigits.length > 0 ? nextDigits : [0];
	}

	return encoded.padStart(length, "0");
}

/** Roundtrip-Helfer für Tests: Base62 → 16 Bytes. */
export function decodeBase62ToBytes(encoded: string): number[] {
	let bytes = [0];
	for (let index = 0; index < encoded.length; index += 1) {
		const value = BASE62_CHARSET.indexOf(encoded[index]);
		if (value < 0) {
			throw new Error(`Invalid Base62 character: ${encoded[index]}`);
		}
		let carry = value;
		for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
			const acc = bytes[byteIndex] * BASE62_RADIX + carry;
			bytes[byteIndex] = acc % 256;
			carry = Math.floor(acc / 256);
		}
		while (carry > 0) {
			bytes.push(carry % 256);
			carry = Math.floor(carry / 256);
		}
	}

	while (bytes.length < 16) {
		bytes.push(0);
	}
	return bytes.slice(0, 16).reverse();
}

/** UUID v4 → 22 Base62-Zeichen. */
export function compressUuidToResourceSuffix(length = RESOURCE_ID_SUFFIX_LENGTH): string {
	return encodeBytesToBase62(uuidStringToBytes(uuidv4()), length);
}

export function isResourceId(value: string, prefix?: string): boolean {
	if (!RESOURCE_ID_REGEX.test(value)) {
		return false;
	}
	if (prefix == null) {
		return true;
	}
	const normalized = prefix.length === 1 ? prefix.toUpperCase() : prefix;
	return value.startsWith(`${normalized}-`);
}

export function generateResourceId(
	resourceType: ResourceType | string,
	existingValues: string[] = []
): string {
	const prefix = RESOURCE_TYPE_PREFIX[resourceType as ResourceType];
	if (!prefix) {
		console.error("generateResourceId - unknown resource type:", resourceType);
		return "";
	}

	const used = new Set(existingValues.filter(Boolean));
	for (let attempt = 0; attempt < 100; attempt += 1) {
		const candidate = `${prefix}-${compressUuidToResourceSuffix()}`;
		if (!used.has(candidate)) {
			return candidate;
		}
	}

	return `${prefix}-${compressUuidToResourceSuffix()}`;
}
