/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0
*/

import { isUsablePrivateKeyPem, isUsablePublicKeyPem } from "./rsaPem";

export type UserSettingsSnapshot = {
	id: string;
	name: string;
	publicKey: string;
	privateKey: string;
};

export function mergeUserSettingsSnapshot(
	incoming: unknown,
	fallback: UserSettingsSnapshot
): UserSettingsSnapshot {
	if (!incoming || typeof incoming !== "object") {
		return fallback;
	}
	const record = incoming as Record<string, unknown>;
	const publicKey = typeof record.publicKey === "string" ? record.publicKey : "";
	const privateKey = typeof record.privateKey === "string" ? record.privateKey : "";
	return {
		id: typeof record.id === "string" && record.id.trim() ? record.id : fallback.id,
		name: typeof record.name === "string" && record.name.trim() ? record.name : fallback.name,
		publicKey: isUsablePublicKeyPem(publicKey) ? publicKey : fallback.publicKey,
		privateKey: isUsablePrivateKeyPem(privateKey) ? privateKey : fallback.privateKey,
	};
}
