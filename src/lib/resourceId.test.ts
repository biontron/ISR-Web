import {
	RESOURCE_ID_REGEX,
	RESOURCE_ID_SUFFIX_LENGTH,
	compressUuidToResourceSuffix,
	decodeBase62ToBytes,
	encodeBytesToBase62,
	generateResourceId,
	isResourceId,
} from "./resourceId";

describe("resourceId", () => {
	it("RESOURCE_ID_REGEX akzeptiert Präfix + Bindestrich + 22 Base62-Zeichen", () => {
		const sample = "A-0123456789ABCDEFGHIJKL";
		expect(sample.slice(2)).toHaveLength(22);
		expect(RESOURCE_ID_REGEX.test(sample)).toBe(true);
		expect(RESOURCE_ID_REGEX.test("a-0123456789ABCDEFGHIJKL")).toBe(false);
		expect(RESOURCE_ID_REGEX.test("A-0123456789ABCDEFGHIJ")).toBe(false);
	});

	it("encodeBytesToBase62 / decodeBase62ToBytes sind verlustfrei für 16 Bytes", () => {
		const bytes = [
			0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
			0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54, 0x32, 0x10,
		];
		const encoded = encodeBytesToBase62(bytes);
		expect(encoded).toHaveLength(RESOURCE_ID_SUFFIX_LENGTH);
		expect(decodeBase62ToBytes(encoded)).toEqual(bytes);
	});

	it("generateResourceId liefert exakt 22 Base62-Zeichen nach Präfix", () => {
		for (const type of ["View", "Group", "Asset", "Dock", "Connection", "Environment"] as const) {
			const id = generateResourceId(type);
			expect(id).toMatch(RESOURCE_ID_REGEX);
			expect(id.slice(2)).toHaveLength(22);
			expect(id.slice(2)).toMatch(/^[A-Za-z0-9]{22}$/);
		}
	});

	it("generateResourceId vermeidet Kollisionen in existingValues", () => {
		const first = generateResourceId("Asset");
		const second = generateResourceId("Asset", [first]);
		expect(second).not.toBe(first);
		expect(second).toMatch(/^A-[A-Za-z0-9]{22}$/);
	});

	it("compressUuidToResourceSuffix erzeugt immer 22 Zeichen", () => {
		expect(compressUuidToResourceSuffix()).toHaveLength(22);
		expect(compressUuidToResourceSuffix()).toMatch(/^[A-Za-z0-9]{22}$/);
	});

	it("isResourceId prüft optional den Präfix (Großbuchstaben)", () => {
		const sample = "C-0123456789ABCDEFGHIJKL";
		expect(isResourceId(sample)).toBe(true);
		expect(isResourceId(sample, "C")).toBe(true);
		expect(isResourceId(sample, "c")).toBe(true);
		expect(isResourceId(sample, "A")).toBe(false);
	});
});
