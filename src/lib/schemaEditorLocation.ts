import {
	collectXPathMatchFieldPaths,
	elementMatchesXPath,
	xpathPathToMstPath,
} from "./elementXPathFilter";
import { resolveSchemaDocumentFieldPath } from "./schemaDocumentFieldPath";
import { buildSchemaDataPath } from "./schemaDeviation";
import { ISchemaFieldModel } from "../Stores/Models/SchemaField.Model";
import { ISchemaGroupModel } from "../Stores/Models/SchemaGroup.Model";
import type { FilterableElement } from "./elementXPathFilter";

export type SchemaItemLocation = {
	visible: boolean;
	mstPath: string;
};

function readDataStructure(item: unknown): { itemName: string; xpath: string } {
	if (item == null || typeof item !== "object" || !("dataStructure" in item)) {
		return { itemName: "", xpath: "" };
	}
	const dataStructure = (item as { dataStructure?: { itemName?: unknown; xpath?: unknown } })
		.dataStructure;
	return {
		itemName: String(dataStructure?.itemName ?? "").trim(),
		xpath: String(dataStructure?.xpath ?? "").trim(),
	};
}

export function isSchemaItemHidden(item: unknown): boolean {
	if (item == null || typeof item !== "object" || !("itemFlags" in item)) {
		return false;
	}
	return (item as { itemFlags?: { hidden?: boolean } }).itemFlags?.hidden === true;
}

export function isAbsoluteElementXPath(xpath: string): boolean {
	const trimmed = xpath.trim();
	return trimmed.startsWith("/") || trimmed.startsWith("element/");
}

export function mstPathToXPath(path: string): string {
	if (!path) {
		return "";
	}
	return path.replace(/\.(\d+)\b/g, "[$1]").replace(/\./g, "/").replace(/\[(\d+)\]/g, (_, index) => {
		return `[${Number(index) + 1}]`;
	});
}

function locationExpressions(pathPrefix: string, xpath: string): string[] {
	if (isAbsoluteElementXPath(xpath)) {
		return [xpath.replace(/^\//, "")];
	}
	const prefixXPath = mstPathToXPath(pathPrefix);
	if (!prefixXPath) {
		return [xpath];
	}
	if (!xpath) {
		return [prefixXPath];
	}
	return [`${prefixXPath}/${xpath}`, `${prefixXPath}//${xpath}`];
}

function fallbackMstPath(element: unknown, item: unknown, pathPrefix: string): string {
	if (item != null && typeof item === "object" && "kind" in item && (item as { kind?: string }).kind === "field") {
		return (
			resolveSchemaDocumentFieldPath(element, item as ISchemaFieldModel, pathPrefix) ?? ""
		);
	}
	if (item != null && typeof item === "object" && "kind" in item && (item as { kind?: string }).kind === "group") {
		return buildSchemaDataPath(pathPrefix, item as ISchemaGroupModel);
	}
	const { itemName } = readDataStructure(item);
	if (!pathPrefix) {
		return itemName;
	}
	return itemName ? `${pathPrefix}.${itemName}` : pathPrefix;
}

export function resolveSchemaItemLocation(
	element: unknown,
	item: unknown,
	pathPrefix: string
): SchemaItemLocation {
	if (isSchemaItemHidden(item)) {
		return { visible: false, mstPath: fallbackMstPath(element, item, pathPrefix) };
	}

	const { xpath } = readDataStructure(item);
	const fallback = fallbackMstPath(element, item, pathPrefix);

	if (!xpath) {
		return { visible: true, mstPath: fallback };
	}

	const filterable = element as FilterableElement;
	for (const composed of locationExpressions(pathPrefix, xpath)) {
		if (!elementMatchesXPath(filterable, composed)) {
			continue;
		}
		if (isAbsoluteElementXPath(xpath)) {
			return { visible: true, mstPath: fallback };
		}
		const matches = collectXPathMatchFieldPaths(filterable, composed);
		const matchedMst = matches[0] ? xpathPathToMstPath(matches[0]) : "";
		return { visible: true, mstPath: matchedMst || fallback };
	}

	return { visible: false, mstPath: fallback };
}
