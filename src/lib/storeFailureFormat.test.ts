import {
	buildStoreFailureDetails,
	formatHttpStatusForDisplay,
	getHttpStatusToneClass,
	isNetworkFetchError,
	serializeResponseHeaders,
} from "./storeFailureFormat";

describe("storeFailureFormat", () => {
	const request = {
		method: "PUT",
		path: "/demo/environments/prod/assets/a1",
		fullUrl: "https://isr.example/api/demo/environments/prod/assets/a1",
	};

	it("formatiert HTTP-Fehler mit Status und Body", () => {
		const details = buildStoreFailureDetails(new Error("Bad Request"), request, {
			status: 400,
			statusText: "Bad Request",
			body: '{"error":"invalid payload"}',
		});
		expect(details.status).toBe(400);
		expect(details.message).toContain("HTTP 400");
		expect(details.message).toContain("Bad Request");
		expect(details.message).toContain("invalid payload");
		expect(details.isNetworkError).toBe(false);
	});

	it("serialisiert Response-Header für Detail-Popover", () => {
		const headers = new Headers({
			"Content-Type": "application/json",
			"X-Request-Id": "abc-123",
		});
		expect(serializeResponseHeaders(headers)).toEqual({
			"content-type": "application/json",
			"x-request-id": "abc-123",
		});
	});

	it("formatiert NetworkError mit Methode und URL", () => {
		const details = buildStoreFailureDetails(
			new TypeError("NetworkError when attempting to fetch resource."),
			request
		);
		expect(details.isNetworkError).toBe(true);
		expect(details.status).toBeUndefined();
		expect(details.message).toContain("Netzwerkfehler");
		expect(details.message).toContain("PUT");
		expect(details.message).toContain(request.fullUrl);
		expect(details.message).toContain("NetworkError");
	});

	it("zeigt NET in der HTTP-Spalte bei Netzwerkfehlern", () => {
		expect(formatHttpStatusForDisplay(undefined, true)).toBe("NET");
		expect(formatHttpStatusForDisplay(500, false)).toBe("500");
	});

	it("ordnet HTTP-Codes Farbklassen zu", () => {
		expect(getHttpStatusToneClass(200, false)).toBe("activity-status-http--success");
		expect(getHttpStatusToneClass(404, false)).toBe("activity-status-http--warning");
		expect(getHttpStatusToneClass(502, false)).toBe("activity-status-http--error");
		expect(getHttpStatusToneClass(undefined, true)).toBe("activity-status-http--error");
		expect(getHttpStatusToneClass(undefined, false)).toBe("activity-status-http--neutral");
	});

	it("erkennt typische Fetch-Netzwerkfehler", () => {
		expect(isNetworkFetchError(new TypeError("Failed to fetch"))).toBe(true);
		expect(isNetworkFetchError(new Error("HTTP 400"))).toBe(false);
	});
});
