/*
 * HTTP-Schicht für alle Backend-Kommunikation (fetch, Auth, request/requestJson).
 *
 * Activity/Status Monitor (einzige REST-UI):
 * - Read (GET, JSON→MobX): restSnapshot.ts → publishRestLoadReport → restLoadErrorRegistry
 *   Fehlerhaftes JSON/rawItem bleibt in RestLoadErrorEntry für JSON-Inspect erhalten.
 * - Write (POST/PUT/DELETE): storeTouchedObjects.ts → api.request → touchedObjectErrorRegistry
 * - UI: ChangeModeToolbar (Badge), ActivityStatusOverviewModal (Common.Component.tsx)
 *
 * KI-Handlungsanweisung: .cursor/rules/activity-status-monitor.mdc
 */
import config from "./config";
import { SchemaBaseType } from "./schemaDomain";
import { schemaItemUri, schemaListUri } from "./schemaRestUris";
import {
	iacPackageItemUri,
	iacPackagesListUri,
	iacTemplateItemUri,
	iacTemplateRunUri,
	iacTemplatesListUri,
} from "./iacRestUris";
import { serializeResponseHeaders } from "./storeFailureFormat";
import {
	classifyLoginHttpFailure,
	isLoginNetworkFailure,
	loginFailureFromNetwork,
	LoginAttemptResult,
	parseLoginErrorCode,
} from "./loginAttempt";

// TODO: use local or session storage, based on user preference
const storage: Storage = localStorage;

export class RestRequestError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly path: string,
		public readonly responseBody: string,
		public readonly statusText: string = "",
		public readonly responseHeaders: Record<string, string> = {}
	) {
		super(message);
		this.name = "RestRequestError";
	}
}

class Api {
	constructor(private baseUrl: string) {}

	public async request(url: string, options?: RequestInit) {
		let headers: HeadersInit = {
			"Content-Type": "application/json",
			...options?.headers,
		};

		const token = storage.getItem("token");

		if (token != null) {
			// headers = { ...headers, Authorization: `Bearer ${token}` };
			// ToDo: Workaround: `Basic ${basicAuth}`
			headers = { ...headers, Authorization: `Basic ${token}` };
		}

		return await fetch(`${this.baseUrl}${url}`, {
			...options,
			headers,
			body: options?.body,
		});
	}

	public async requestJson(url: string, options?: RequestInit) {
		const response = await this.request(url, options);
		if (response.ok) {
			return await response.json();
		}

		const text = await response.text();
		console.error("Server error:", response.status, text);
		throw new RestRequestError(
			`API request failed. HTTP ${response.status}: ${text}`,
			response.status,
			url,
			text,
			response.statusText,
			serializeResponseHeaders(response.headers)
		);
	}

	public async requestText(url: string, options?: RequestInit) {
		const response = await this.request(url, options);
		const text = await response.text();
		if (response.ok) {
			return text;
		}

		console.error("Server error:", response.status, text);
		throw new RestRequestError(
			`API request failed. HTTP ${response.status}: ${text}`,
			response.status,
			url,
			text,
			response.statusText,
			serializeResponseHeaders(response.headers)
		);
	}

	public async get(url: string) {
		return await this.requestJson(url);
	}

	public async post(url: string, body: object) {
		return await this.requestJson(url, {
			method: "POST",
			body: JSON.stringify(body),
		});
	}

	public async put(url: string, body: object) {
		return await this.requestJson(url, {
			method: "PUT",
			body: JSON.stringify(body),
		});
	}

	public async delete(url: string) {
		return await this.requestJson(url, {
			method: "DELETE",
		});
	}

	/**
	 * Login to the API
	 * @returns ok:true bei Token, sonst klassifizierter Fehler (Credentials, Domain, Verbindung)
	 */
	public async login(username: string, password: string, domain: string): Promise<LoginAttemptResult> {
		const body = JSON.stringify({
			username,
			password,
		});

		try {
			const response = await this.request(`/${domain}/login`, {
				method: "POST",
				body,
			});
			if (response.ok) {
				const data = await response.json();

				if (data.token) {
					storage.setItem("token", data.token);
					// ToDo: Workaround: `Basic ${basicAuth}`
					storage.setItem("token", window.btoa(username + ":" + password));
					return { ok: true };
				}

				return { ok: false, kind: "server", detail: "Invalid login token received" };
			}

			const text = await response.text();
			const errorCode = parseLoginErrorCode(text);
			const kind = classifyLoginHttpFailure(response.status, text);
			if (kind === "server") {
				console.error("Server error:", response.status, text);
			}
			return {
				ok: false,
				kind,
				status: response.status,
				errorCode,
				detail: text.trim() || undefined,
			};
		} catch (error) {
			if (isLoginNetworkFailure(error)) {
				return loginFailureFromNetwork(error);
			}
			console.error("Login failed:", error);
			return {
				ok: false,
				kind: "server",
				detail: error instanceof Error ? error.message : String(error),
			};
		}
	}

	public async logout() {
		storage.removeItem("token");
		return true;
	}

	public async getSchemaList(domain: string, baseType: SchemaBaseType) {
		return this.get(schemaListUri(domain, baseType));
	}

	public async getSchemaItem(domain: string, baseType: SchemaBaseType, schemaId: string) {
		return this.get(schemaItemUri(domain, baseType, schemaId));
	}

	public async putSchemaItem(
		domain: string,
		baseType: SchemaBaseType,
		schemaId: string,
		body: object
	) {
		return this.put(schemaItemUri(domain, baseType, schemaId), body);
	}

	public async postSchemaItem(
		domain: string,
		baseType: SchemaBaseType,
		schemaId: string,
		body: object
	) {
		return this.post(schemaItemUri(domain, baseType, schemaId), body);
	}

	public async getViews(domain: string) {
		return await this.get(`/${domain}/views`);
	}

	public async getAssets(domain: string, environment: string) {
		return await this.get(`/${domain}/environments/${environment}/assets`);
	}

	public async getConnections(domain: string, environment: string) {
		return await this.get(`/${domain}/environments/${environment}/connections`);
	}

	public async getGroups(domain: string, viewId: string) {
		return await this.get(`/${domain}/views/${viewId}/groups`);
	}

	public async getIacPackages(domain: string) {
		return await this.get(iacPackagesListUri(domain));
	}

	public async getIacPackage(domain: string, packageId: string) {
		return await this.get(iacPackageItemUri(domain, packageId));
	}

	public async getIacTemplates(domain: string, packageId: string) {
		return await this.get(iacTemplatesListUri(domain, packageId));
	}

	public async getIacTemplate(
		domain: string,
		packageId: string,
		templateId: string,
		version?: string | null
	) {
		return await this.requestText(
			iacTemplateItemUri(domain, packageId, templateId, { version: version ?? undefined })
		);
	}

	public async putIacTemplate(
		domain: string,
		packageId: string,
		templateId: string,
		xmlBody: string,
		version?: string | null
	) {
		return await this.requestText(
			iacTemplateItemUri(domain, packageId, templateId, { version: version ?? undefined }),
			{
				method: "PUT",
				body: xmlBody,
				headers: { "Content-Type": "application/xml" },
			}
		);
	}

	public async postIacTemplate(
		domain: string,
		packageId: string,
		templateId: string,
		xmlBody: string
	) {
		return await this.requestText(iacTemplateItemUri(domain, packageId, templateId), {
			method: "POST",
			body: xmlBody,
			headers: { "Content-Type": "application/xml" },
		});
	}

	public async deleteIacTemplate(
		domain: string,
		packageId: string,
		templateId: string,
		version?: string | null
	) {
		return await this.requestText(
			iacTemplateItemUri(domain, packageId, templateId, { version: version ?? undefined }),
			{ method: "DELETE" }
		);
	}

	public async runIacTemplate(
		domain: string,
		packageId: string,
		templateId: string,
		version?: string | null
	) {
		return await this.requestText(
			iacTemplateRunUri(domain, packageId, templateId, { version: version ?? undefined })
		);
	}
}

const api = new Api(config.apiRoot);

export default api;
