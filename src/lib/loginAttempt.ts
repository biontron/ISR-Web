import { isNetworkFetchError } from "./storeFailureFormat";

export type LoginFailureKind = "credentials" | "domain" | "connection" | "server";

export type LoginAttemptResult =
	| { ok: true }
	| {
			ok: false;
			kind: LoginFailureKind;
			status?: number;
			errorCode?: string;
			detail?: string;
	  };

export function parseLoginErrorCode(body: string): string | undefined {
	const trimmed = body.trim();
	if (!trimmed) {
		return undefined;
	}

	try {
		const data = JSON.parse(trimmed) as Record<string, unknown>;
		if (typeof data.error === "string" && data.error.trim() !== "") {
			return data.error.trim();
		}
		if (data.error && typeof data.error === "object") {
			const nested = data.error as Record<string, unknown>;
			if (typeof nested.code === "string" && nested.code.trim() !== "") {
				return nested.code.trim();
			}
			if (typeof nested.error === "string" && nested.error.trim() !== "") {
				return nested.error.trim();
			}
		}
		if (typeof data.code === "string" && data.code.trim() !== "") {
			return data.code.trim();
		}
	} catch {
		if (trimmed.includes("invalid-credentials")) {
			return "invalid-credentials";
		}
		if (trimmed.includes("domain-access-denied")) {
			return "domain-access-denied";
		}
	}

	return undefined;
}

export function classifyLoginHttpFailure(status: number, body: string): LoginFailureKind {
	const errorCode = parseLoginErrorCode(body);
	if (errorCode === "invalid-credentials") {
		return "credentials";
	}
	if (errorCode === "domain-access-denied") {
		return "domain";
	}
	if (status === 401) {
		return "credentials";
	}
	if (status === 403) {
		return "domain";
	}
	return "server";
}

export function loginFailureFromNetwork(error: unknown): Extract<LoginAttemptResult, { ok: false }> {
	return {
		ok: false,
		kind: "connection",
		detail: error instanceof Error ? error.message : undefined,
	};
}

export function isLoginNetworkFailure(error: unknown): boolean {
	return isNetworkFetchError(error);
}

export function loginFailureMessageKey(kind: LoginFailureKind): string {
	switch (kind) {
		case "credentials":
			return "general.login_invalid";
		case "domain":
			return "general.login_domain_denied";
		case "connection":
			return "general.login_connection_error";
		default:
			return "general.login_error";
	}
}

function truncateDetail(detail: string): string {
	return detail.length > 180 ? `${detail.slice(0, 177)}…` : detail;
}

export function formatLoginFailureMessage(
	result: Extract<LoginAttemptResult, { ok: false }>,
	text: (key: string) => string
): string {
	const headline = text(loginFailureMessageKey(result.kind));
	if (result.kind === "connection" && result.detail?.trim()) {
		return `${headline}: ${truncateDetail(result.detail)}`;
	}
	if (result.kind === "server" && result.status) {
		return `${headline} (HTTP ${result.status})`;
	}
	if (result.kind === "server" && result.detail?.trim()) {
		return `${headline}: ${truncateDetail(result.detail)}`;
	}
	return headline;
}
