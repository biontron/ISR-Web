import { ActivityStatusRow } from "./activityStatusOverview";
import {
	buildStoreFailureTooltip,
	formatResponseHeadersForDisplay,
} from "./storeFailureFormat";

export function hasRestCommunicationDetail(row: ActivityStatusRow): boolean {
	return !!(
		row.errorMessage ||
		row.rest.method ||
		row.rest.fullUrl ||
		row.httpStatus != null ||
		row.isNetworkError ||
		row.rest.responseBody ||
		row.rest.responseHeaders
	);
}

export function buildRestCommunicationCopyText(row: ActivityStatusRow): string {
	const sections: string[] = [];

	if (row.errorMessage) {
		sections.push(row.errorMessage);
	}

	if (row.rest.method || row.rest.fullUrl) {
		sections.push(`${row.rest.method ?? "GET"} ${row.rest.fullUrl}`.trim());
	}

	if (row.httpStatus != null || row.isNetworkError) {
		sections.push(
			buildStoreFailureTooltip({
				message: "",
				request: row.rest,
				status: row.httpStatus,
				statusText: row.httpStatusText,
				responseBody: row.rest.responseBody,
				responseHeaders: row.rest.responseHeaders,
				isNetworkError: row.isNetworkError,
			}).trim()
		);
	} else {
		const headers = formatResponseHeadersForDisplay(row.rest.responseHeaders);
		if (headers) {
			sections.push(headers);
		}
		if (row.rest.responseBody) {
			sections.push(String(row.rest.responseBody));
		}
	}

	return sections.filter(Boolean).join("\n\n");
}

/** @deprecated Use buildRestCommunicationCopyText */
export function buildActivityRowCopyText(row: ActivityStatusRow): string {
	return buildRestCommunicationCopyText(row);
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

export async function copyActivityRowToClipboard(row: ActivityStatusRow): Promise<boolean> {
	return copyTextToClipboard(buildRestCommunicationCopyText(row));
}
