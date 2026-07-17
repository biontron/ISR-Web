import { TouchedObjectRestRequest } from "./restRequestForTouchedObject";

const MAX_BODY_SNIPPET = 400;

export function serializeResponseHeaders(headers: Headers): Record<string, string> {
	const result: Record<string, string> = {};
	headers.forEach((value, key) => {
		result[key] = value;
	});
	return result;
}

export function formatResponseHeadersForDisplay(
	headers?: Record<string, string>
): string | undefined {
	if (!headers || Object.keys(headers).length === 0) {
		return undefined;
	}

	return Object.entries(headers)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => `${key}: ${value}`)
		.join("\n");
}

function truncate(text: string, max: number): string {
	if (text.length <= max) {
		return text;
	}
	return `${text.slice(0, max)}…`;
}

export function isNetworkFetchError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}
	const message = error.message.toLowerCase();
	return (
		error.name === "TypeError" ||
		message.includes("networkerror") ||
		message.includes("failed to fetch") ||
		message.includes("load failed") ||
		message.includes("network request failed")
	);
}

export interface StoreFailureDetails {
	message: string;
	status?: number;
	statusText?: string;
	responseBody?: string;
	isNetworkError: boolean;
}

export function buildStoreFailureDetails(
	error: unknown,
	request: TouchedObjectRestRequest,
	http?: { status: number; statusText: string; body?: string }
): StoreFailureDetails {
	if (http) {
		const statusText = http.statusText?.trim() ?? "HTTP-Fehler";
		const messageParts = [`HTTP ${http.status}`, statusText];
		if (http.body) {
			messageParts.push(truncate(http.body, MAX_BODY_SNIPPET));
		}
		messageParts.push(`${request.method} ${request.fullUrl}`);
		return {
			message: messageParts.join(" · "),
			status: http.status,
			statusText,
			responseBody: http.body,
			isNetworkError: false,
		};
	}

	const err = error instanceof Error ? error : new Error(String(error));
	const network = isNetworkFetchError(err);
	const headline = network ? "Netzwerkfehler (keine HTTP-Antwort)" : err.name || "Fehler";
	let corsHint = "";
	if (network) {
		corsHint =
			"Hinweis: Keine HTTP-Antwort — Netzwerk prüfen oder CORS-Header der API (Origin muss erlaubt sein, auch bei 4xx/5xx).";
	}

	return {
		message: [headline, corsHint, `${request.method} ${request.fullUrl}`, err.message]
			.filter(Boolean)
			.join(" · "),
		isNetworkError: network,
	};
}

export function formatHttpStatusForDisplay(
	status?: number,
	isNetworkError?: boolean
): string {
	if (status != null && status > 0) {
		return String(status);
	}
	if (isNetworkError) {
		return "NET";
	}
	return "—";
}

export function getHttpStatusToneClass(
	status?: number,
	isNetworkError?: boolean
): string {
	if (isNetworkError) {
		return "activity-status-http--error";
	}
	if (status == null || status <= 0) {
		return "activity-status-http--neutral";
	}
	if (status >= 200 && status < 300) {
		return "activity-status-http--success";
	}
	if (status >= 400 && status < 500) {
		return "activity-status-http--warning";
	}
	if (status >= 500) {
		return "activity-status-http--error";
	}
	return "activity-status-http--neutral";
}

export function buildStoreFailureTooltip(failure: {
	message: string;
	request: { method: string; fullUrl: string };
	status?: number;
	statusText?: string;
	responseBody?: string;
	responseHeaders?: Record<string, string>;
	isNetworkError?: boolean;
}): string {
	const parts: string[] = [];
	if (failure.isNetworkError) {
		parts.push("Keine HTTP-Antwort vom Server");
	} else if (failure.status != null) {
		parts.push(`HTTP ${failure.status}${failure.statusText ? ` ${failure.statusText}` : ""}`);
	}
	parts.push(failure.message);
	parts.push(failure.request.method + " " + failure.request.fullUrl);
	const headers = formatResponseHeadersForDisplay(failure.responseHeaders);
	if (headers) {
		parts.push(headers);
	}
	if (failure.responseBody) {
		parts.push(failure.responseBody);
	}
	return parts.join("\n");
}
