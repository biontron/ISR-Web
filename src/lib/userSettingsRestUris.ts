export function encodeUsernameHex(username: string): string {
	const bytes = new TextEncoder().encode(username);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function decodeUsernameHex(usernameHex: string): string | null {
	const clean = usernameHex.trim().toLowerCase();
	if (!/^[0-9a-f]+$/.test(clean) || clean.length % 2 !== 0) {
		return null;
	}
	const bytes = new Uint8Array(clean.length / 2);
	for (let index = 0; index < bytes.length; index += 1) {
		bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
	}
	return new TextDecoder().decode(bytes);
}

export function userSettingsUri(domain: string, username: string): string {
	return `/${domain}/users/${encodeUsernameHex(username)}/settings`;
}
