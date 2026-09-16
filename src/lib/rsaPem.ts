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
