import { decodeUsernameHex, encodeUsernameHex, userSettingsUri } from "./userSettingsRestUris";

describe("userSettingsRestUris", () => {
	it("hex-encodes Mr. X", () => {
		expect(encodeUsernameHex("Mr. X")).toBe("4d722e2058");
		expect(decodeUsernameHex("4d722e2058")).toBe("Mr. X");
		expect(userSettingsUri("demo", "Mr. X")).toBe("/demo/users/4d722e2058/settings");
	});

	it("hex-encodes slash and hash", () => {
		expect(encodeUsernameHex("a/b#c")).toBe("612f622363");
		expect(decodeUsernameHex("612f622363")).toBe("a/b#c");
	});

	it("hex-encodes unicode", () => {
		const hex = encodeUsernameHex("Müller");
		expect(decodeUsernameHex(hex)).toBe("Müller");
	});
});
