import { getSnapshot } from "mobx-state-tree";
import { IRootStore } from "../Stores/Root.Store";
import { TouchedObjectRef } from "./touchedObjects";
import { rewriteFilterRulesInSnapshot } from "./filterRuleNormalize";
import { parseDockRef } from "./connectionEndpointRef";
import { isDockLinkRef } from "./resourceId";

function asRecord(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

const ASSET_KEY_ORDER = [
	"id",
	"definition",
	"ownerIdRef",
	"environmentId",
	"docks",
	"attachments",
	"properties",
	"settings",
	"elementIdRefs",
	"filterRules",
] as const;

/** Live-XSD ViewGroup: keine docks. */
const GROUP_KEY_ORDER = [
	"id",
	"definition",
	"parentIdRef",
	"elementIdRefs",
	"filterRules",
	"attachments",
	"properties",
	"settings",
] as const;

/** Live-XSD Connection: id, definition, links, settings — keine weiteren Kinder. */
const CONNECTION_KEY_ORDER = ["id", "definition", "links", "settings"] as const;

function orderRecord(
	source: Record<string, unknown>,
	preferred: readonly string[],
	includeUnknown = true
): Record<string, unknown> {
	const payload: Record<string, unknown> = {};
	for (const key of preferred) {
		if (Object.prototype.hasOwnProperty.call(source, key)) {
			payload[key] = source[key];
		}
	}
	if (includeUnknown) {
		for (const key of Object.keys(source)) {
			if (!Object.prototype.hasOwnProperty.call(payload, key)) {
				payload[key] = source[key];
			}
		}
	}
	return payload;
}

function restDockLinkRef(componentRef: unknown, dockRef: unknown): string | null {
	const component =
		typeof componentRef === "string" && componentRef.trim() ? componentRef.trim() : "";
	const dockId =
		typeof dockRef === "string" ? parseDockRef(dockRef) ?? dockRef.trim() : "";

	// ISR-Component-ID (A/V/G/C/E). Dock-IDs (D-) nicht bevorzugen — die können nach Reload veralten.
	if (component && isDockLinkRef(component) && !component.startsWith("D-")) {
		return component;
	}
	if (isDockLinkRef(dockId)) {
		return dockId;
	}
	if (component && isDockLinkRef(component)) {
		return component;
	}
	return component || null;
}

function mapConnectionLink(link: unknown): Record<string, unknown> {
	const source = asRecord(link) ?? {};
	const mapped: Record<string, unknown> = { ...source };
	mapped.fromComponentRef = restDockLinkRef(source.fromComponentRef, source.fromDockRef);
	mapped.toComponentRef = restDockLinkRef(source.toComponentRef, source.toDockRef);
	return mapped;
}

function omitDockpartVersions(docks: unknown): unknown {
	if (!Array.isArray(docks)) {
		return docks;
	}
	return docks.map((dock) => {
		const record = asRecord(dock);
		if (!record || !Array.isArray(record.dockparts)) {
			return dock;
		}
		return {
			...record,
			dockparts: record.dockparts.map((part) => {
				const partRecord = asRecord(part);
				if (!partRecord || !Object.prototype.hasOwnProperty.call(partRecord, "versions")) {
					return part;
				}
				const { versions: _versions, ...rest } = partRecord;
				return rest;
			}),
		};
	});
}

/**
 * ViewGroup-REST: id, definition, parentIdRef, elementIdRefs, filterRules,
 * attachments, properties, settings — keine docks.
 */
export function restWritePayloadForGroup(snapshot: unknown): Record<string, unknown> {
	const source = asRecord(snapshot) ?? {};
	const withRules = rewriteFilterRulesInSnapshot(source) as Record<string, unknown>;
	return orderRecord(withRules, GROUP_KEY_ORDER, false);
}

/**
 * Asset-REST: id, definition, ownerIdRef, environmentId (Live-XSD).
 * environmentId muss ein existierendes Environment sein (URL + Körper).
 */
export function restWritePayloadForAsset(snapshot: unknown): Record<string, unknown> {
	const source = { ...(asRecord(snapshot) ?? {}) };
	const payload = orderRecord(source, ASSET_KEY_ORDER);
	if (Object.prototype.hasOwnProperty.call(payload, "docks")) {
		payload.docks = omitDockpartVersions(payload.docks);
	}
	return payload;
}

/**
 * Connection-REST folgt dem Live-XSD: id, definition, links, settings.
 * kind / Bridge / environmentId bleiben im Store; Umgebung steht in der URL.
 * fromComponentRef/toComponentRef: DockLinkRefType — ISR-ID der Component, sonst Dock-ID.
 */
export function restWritePayloadForConnection(snapshot: unknown): Record<string, unknown> {
	const source = asRecord(snapshot) ?? {};
	const links = Array.isArray(source.links) ? source.links.map(mapConnectionLink) : [];
	return orderRecord({ ...source, links }, CONNECTION_KEY_ORDER, false);
}

/** MST-Snapshot → REST-Schreib-Body für Activity-Status-Vorschau. */
export function restWritePayloadForRef(
	root: IRootStore,
	ref: TouchedObjectRef
): unknown {
	const snapshot = getSnapshot(ref.element);
	if (ref.kind === "Group") {
		return restWritePayloadForGroup(snapshot);
	}
	if (ref.kind === "View") {
		return rewriteFilterRulesInSnapshot(snapshot);
	}
	if (ref.kind === "Asset") {
		return restWritePayloadForAsset(snapshot);
	}
	if (ref.kind === "Connection") {
		return restWritePayloadForConnection(snapshot);
	}
	return snapshot;
}

export function stringifyRestBody(payload: unknown): { body?: string; error?: string } {
	try {
		return { body: JSON.stringify(payload) };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
