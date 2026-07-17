import config from "./config";
import { SchemaBaseType } from "./schemaDomain";
import { schemaItemUri, schemaListUri } from "./schemaRestUris";

export type RestUrlKind =
	| "EditorSchema"
	| "DockpartSchema"
	| "IaCPackage"
	| "IaCTemplate"
	| "View"
	| "Group"
	| "Asset"
	| "Connection";

export type RestUrlOperation = "list" | "get" | "create" | "update" | "delete";

export interface RestUrlIds {
	packageName?: string;
	templateName?: string;
	templateVersion?: string | null;
	schemaId?: string;
	schemaBaseType?: SchemaBaseType;
	schemaStoreType?: SchemaBaseType;
	itemId?: string;
	viewId?: string;
	env?: string;
}

export interface RestUrlDescriptor {
	method: string;
	path: string;
	fullUrl: string;
}

export function buildRestUrl(
	domain: string,
	kind: RestUrlKind,
	operation: RestUrlOperation,
	ids: RestUrlIds = {}
): RestUrlDescriptor {
	let path = "";
	let method = "GET";

	switch (kind) {
		case "EditorSchema": {
			const storeType: SchemaBaseType =
				ids.schemaStoreType ?? ids.schemaBaseType ?? "COMPONENT";
			if (operation === "list") {
				path = schemaListUri(domain, storeType);
			} else {
				path = schemaItemUri(domain, storeType, ids.schemaId ?? ids.itemId ?? "");
				if (operation === "update") {
					method = "PUT";
				} else if (operation === "create") {
					method = "POST";
				}
			}
			break;
		}
		case "DockpartSchema": {
			const baseType: SchemaBaseType = "DOCKPART";
			if (operation === "list") {
				path = schemaListUri(domain, baseType);
			} else {
				path = schemaItemUri(domain, baseType, ids.schemaId ?? ids.itemId ?? "");
				if (operation === "update") {
					method = "PUT";
				} else if (operation === "create") {
					method = "POST";
				}
			}
			break;
		}
		case "IaCPackage":
			path = `/${domain}/iac/packages`;
			method = "GET";
			break;
		case "IaCTemplate":
			if (operation === "list") {
				path = `/${domain}/iac/packages/${ids.packageName ?? ""}/templates`;
			} else {
				const basePath = `/${domain}/iac/packages/${ids.packageName ?? ""}/templates/${ids.templateName ?? ids.itemId ?? ""}`;
				const params = new URLSearchParams();
				if (ids.templateVersion) {
					params.set("version", ids.templateVersion);
				}
				const query = params.toString();
				path = query ? `${basePath}?${query}` : basePath;
				if (operation === "update") {
					method = "PUT";
				} else if (operation === "create") {
					method = "POST";
				} else if (operation === "delete") {
					method = "DELETE";
				}
			}
			break;
		case "View":
			if (operation === "list") {
				path = `/${domain}/views`;
			} else if (operation === "create") {
				path = `/${domain}/views`;
				method = "POST";
			} else if (operation === "update") {
				path = `/${domain}/views/${ids.itemId ?? ""}`;
				method = "PUT";
			} else if (operation === "delete") {
				path = `/${domain}/views/${ids.itemId ?? ""}`;
				method = "DELETE";
			}
			break;
		case "Group":
			if (operation === "list") {
				path = `/${domain}/views/${ids.viewId ?? ""}/groups`;
			} else if (operation === "create") {
				path = `/${domain}/views/${ids.viewId ?? ""}/groups`;
				method = "POST";
			} else if (operation === "update") {
				path = `/${domain}/views/${ids.viewId ?? ""}/groups/${ids.itemId ?? ""}`;
				method = "PUT";
			} else if (operation === "delete") {
				path = `/${domain}/views/${ids.viewId ?? ""}/groups/${ids.itemId ?? ""}`;
				method = "DELETE";
			}
			break;
		case "Asset":
			if (operation === "list") {
				path = `/${domain}/environments/${ids.env ?? ""}/assets`;
			} else if (operation === "create") {
				path = `/${domain}/environments/${ids.env ?? ""}/assets`;
				method = "POST";
			} else if (operation === "update") {
				path = `/${domain}/environments/${ids.env ?? ""}/assets/${ids.itemId ?? ""}`;
				method = "PUT";
			} else if (operation === "delete") {
				path = `/${domain}/environments/${ids.env ?? ""}/assets/${ids.itemId ?? ""}`;
				method = "DELETE";
			}
			break;
		case "Connection":
			if (operation === "list") {
				path = `/${domain}/environments/${ids.env ?? ""}/connections`;
			} else if (operation === "create") {
				path = `/${domain}/environments/${ids.env ?? ""}/connections`;
				method = "POST";
			} else if (operation === "update") {
				path = `/${domain}/environments/${ids.env ?? ""}/connections/${ids.itemId ?? ""}`;
				method = "PUT";
			} else if (operation === "delete") {
				path = `/${domain}/environments/${ids.env ?? ""}/connections/${ids.itemId ?? ""}`;
				method = "DELETE";
			}
			break;
		default:
			path = `/${domain}`;
	}

	return {
		method,
		path,
		fullUrl: `${config.apiRoot}${path}`,
	};
}
