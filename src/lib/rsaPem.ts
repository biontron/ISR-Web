function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	const chunkSize = 0x8000;
	for (let index = 0; index < bytes.length; index += chunkSize) {
		const chunk = Array.from(bytes.subarray(index, index + chunkSize));
		binary += String.fromCharCode.apply(null, chunk);
	}
	return btoa(binary);
}

export function arrayBufferToPem(buffer: ArrayBuffer, label: string): string {
	const body = bytesToBase64(new Uint8Array(buffer)).match(/.{1,64}/g) ?? [];
	return `-----BEGIN ${label}-----\n${body.join("\n")}\n-----END ${label}-----\n`;
}

export type RsaKeyPairPem = {
	publicKey: string;
	privateKey: string;
};

export function isUsablePublicKeyPem(pem: string | undefined): boolean {
	const trimmed = pem?.trim() ?? "";
	return (
		trimmed.includes("BEGIN PUBLIC KEY") &&
		trimmed.includes("END PUBLIC KEY") &&
		trimmed !== "geheim" &&
		trimmed.length > 80
	);
}

export function isUsablePrivateKeyPem(pem: string | undefined): boolean {
	const trimmed = pem?.trim() ?? "";
	return (
		trimmed.includes("BEGIN PRIVATE KEY") &&
		trimmed.includes("END PRIVATE KEY") &&
		trimmed !== "geheim" &&
		trimmed.length > 80
	);
}

function pemBodyToBytes(pem: string): Uint8Array {
	const body = pem
		.replace(/-----BEGIN [A-Z ]+-----/g, "")
		.replace(/-----END [A-Z ]+-----/g, "")
		.replace(/\s+/g, "");
	const binary = atob(body);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

const RSA_OAEP_SHA256 = {
	name: "RSA-OAEP",
	hash: "SHA-256",
} as const;

export async function importRsaOaepPublicKey(pem: string): Promise<CryptoKey> {
	return crypto.subtle.importKey("spki", pemBodyToBytes(pem), RSA_OAEP_SHA256, false, ["encrypt"]);
}

/** RSA-OAEP SHA-256, Base64 ohne Zeilenumbruch — wie test_crypto.xqy / ICCM. */
export async function encryptUtf8ToBase64(publicKeyPem: string, plain: string): Promise<string> {
	const key = await importRsaOaepPublicKey(publicKeyPem);
	const cipher = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, new TextEncoder().encode(plain));
	return bytesToBase64(new Uint8Array(cipher));
}

export async function generateRsaOaepKeyPairPem(): Promise<RsaKeyPairPem> {
	const pair = await crypto.subtle.generateKey(
		{
			name: "RSA-OAEP",
			modulusLength: 4096,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: "SHA-256",
		},
		true,
		["encrypt", "decrypt"]
	);
	const publicKey = await crypto.subtle.exportKey("spki", pair.publicKey);
	const privateKey = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
	return {
		publicKey: arrayBufferToPem(publicKey, "PUBLIC KEY"),
		privateKey: arrayBufferToPem(privateKey, "PRIVATE KEY"),
	};
}
