import {
	classifyLoginHttpFailure,
	formatLoginFailureMessage,
	parseLoginErrorCode,
} from "./loginAttempt";

describe("loginAttempt", () => {
	it("erkennt invalid-credentials aus JSON und Status 401", () => {
		expect(parseLoginErrorCode('{"error":"invalid-credentials"}')).toBe("invalid-credentials");
		expect(classifyLoginHttpFailure(401, '{"error":"invalid-credentials"}')).toBe("credentials");
		expect(classifyLoginHttpFailure(401, "")).toBe("credentials");
	});

	it("erkennt domain-access-denied aus JSON und Status 403", () => {
		expect(parseLoginErrorCode('{"error":"domain-access-denied"}')).toBe("domain-access-denied");
		expect(classifyLoginHttpFailure(403, '{"error":"domain-access-denied"}')).toBe("domain");
		expect(classifyLoginHttpFailure(403, "")).toBe("domain");
	});

	it("bevorzugt den error-Code vor dem HTTP-Status", () => {
		expect(classifyLoginHttpFailure(403, '{"error":"invalid-credentials"}')).toBe("credentials");
		expect(classifyLoginHttpFailure(401, '{"error":"domain-access-denied"}')).toBe("domain");
	});

	it("formatiert lastMessage für Credentials, Domain und Verbindung", () => {
		const text = (key: string) =>
			({
				"general.login_invalid": "Anmeldung fehlgeschlagen: Ungültige Zugangsdaten",
				"general.login_domain_denied": "Anmeldung fehlgeschlagen: Ungültige Domäne",
				"general.login_connection_error": "Verbindungsfehler",
				"general.login_error": "Anmeldung fehlgeschlagen",
			}[key] ?? key);

		expect(
			formatLoginFailureMessage({ ok: false, kind: "credentials", status: 401 }, text)
		).toBe("Anmeldung fehlgeschlagen: Ungültige Zugangsdaten");
		expect(
			formatLoginFailureMessage({ ok: false, kind: "domain", status: 403 }, text)
		).toBe("Anmeldung fehlgeschlagen: Ungültige Domäne");
		expect(
			formatLoginFailureMessage(
				{ ok: false, kind: "connection", detail: "Failed to fetch" },
				text
			)
		).toBe("Verbindungsfehler: Failed to fetch");
	});
});
