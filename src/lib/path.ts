// src/lib/path.ts
import { destroy, isStateTreeNode } from "mobx-state-tree";
import { IElement } from "../Stores/Models/Element.Model";
import { ISchemaGroupModel } from "../Stores/Models/SchemaGroup.Model";
import { buildDefaultEntryFromSchemaItems } from "./schemaEntryDefaults";
import { isArrayCollectionGroup } from "./schemaDeviation";

export type ElementType = any;

function isExtensible(obj: any): boolean {
	return obj != null && typeof obj === "object" && !Object.isFrozen(obj) && !Object.isSealed(obj);
}

export function getValueByPath(element: any, path: string): any {
	if (!path || !element) return undefined;

	const segments = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
	let current = element;

	for (const segment of segments) {
		if (current == null) return undefined;

		if (current.get && typeof current.get === "function") {
			current = current.get(segment);
			continue;
		}

		if (/^\d+$/.test(segment) && Array.isArray(current)) {
			current = current[parseInt(segment, 10)];
		} else {
			current = current[segment];
		}
	}
	return current;
}

function assignProperty(target: any, segment: string, value: any): boolean {
	if (/^\d+$/.test(segment) && Array.isArray(target)) {
		target[parseInt(segment, 10)] = value;
		return true;
	}

	if (typeof target.set === "function" && typeof target.get === "function") {
		target.set(segment, value);
		return true;
	}

	if (isStateTreeNode(target)) {
		(target as Record<string, unknown>)[segment] = value;
		return true;
	}

	if (isExtensible(target)) {
		target[segment] = value;
		return true;
	}

	return false;
}

function segmentExists(target: any, segment: string): boolean {
	if (typeof target?.has === "function") {
		return target.has(segment);
	}

	if (typeof target?.get === "function") {
		return target.get(segment) !== undefined;
	}

	if (/^\d+$/.test(segment) && Array.isArray(target)) {
		const index = parseInt(segment, 10);
		return index >= 0 && index < target.length;
	}

	if (target == null || typeof target !== "object") {
		return false;
	}

	return Object.prototype.hasOwnProperty.call(target, segment);
}

function getSegmentValue(target: any, segment: string): any {
	if (typeof target?.get === "function") {
		return target.get(segment);
	}

	if (/^\d+$/.test(segment) && Array.isArray(target)) {
		return target[parseInt(segment, 10)];
	}

	return target?.[segment];
}

function createMissingSegment(target: any, segment: string, nextIsNumeric: boolean): any {
	const emptyValue = nextIsNumeric ? [] : {};

	if (/^\d+$/.test(segment) && Array.isArray(target)) {
		const idx = parseInt(segment, 10);
		if (!segmentExists(target, segment) && isExtensible(target)) {
			target[idx] = emptyValue;
		}
		return target[idx];
	}

	if (typeof target.get === "function") {
		if (!segmentExists(target, segment)) {
			if (isStateTreeNode(target) || isExtensible(target)) {
				assignProperty(target, segment, emptyValue);
			} else {
				return undefined;
			}
		}
		return target.get(segment);
	}

	if (!segmentExists(target, segment)) {
		if (!assignProperty(target, segment, emptyValue)) {
			return undefined;
		}
	}
	return getSegmentValue(target, segment);
}

export function setValueByPath(element: any, path: string, value: any): void {
	if (!path || !element) return;

	const segments = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
	let current: any = element;

	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i];
		const isLast = i === segments.length - 1;

		if (isLast) {
			if (assignProperty(current, segment, value)) {
				return;
			}
			if (i === 0) {
				console.warn(`[setValueByPath] Cannot set property "${segment}" at path: ${path}`);
				return;
			}
			const parentPath = segments.slice(0, i).join(".");
			const parentValue = getValueByPath(element, parentPath);
			if (parentValue == null || typeof parentValue !== "object" || Array.isArray(parentValue)) {
				console.warn(`[setValueByPath] Cannot set property "${segment}" on non-extensible object at path: ${path}`);
				return;
			}
			setValueByPath(element, parentPath, {
				...(parentValue as Record<string, unknown>),
				[segment]: value,
			});
			return;
		}

		const nextIsNumeric = /^\d+$/.test(segments[i + 1] || "");
		const next = createMissingSegment(current, segment, nextIsNumeric);
		if (next === undefined) {
			console.warn(`[setValueByPath] Cannot create property "${segment}" at path: ${path}`);
			return;
		}
		current = next;
	}
}

function getArrayParent(element: any, path: string): { parent: unknown; key: string; parentPath: string } | null {
	const segments = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
	if (segments.length === 0) {
		return null;
	}

	const key = segments[segments.length - 1];
	const parentPath = segments.slice(0, -1).join(".");
	const parent = parentPath ? getValueByPath(element, parentPath) : element;

	if (parent == null || typeof parent !== "object") {
		return null;
	}

	return { parent, key, parentPath };
}

function replaceArrayAtPath(
	element: any,
	path: string,
	next: unknown[]
): void {
	const target = getArrayParent(element, path);
	if (!target) {
		return;
	}

	const { parent, key, parentPath } = target;

	if (next.length === 0) {
		if (isStateTreeNode(parent)) {
			(parent as Record<string, unknown>)[key] = [];
			return;
		}
		if (typeof (parent as { set?: unknown }).set === "function") {
			(parent as { set: (k: string, v: unknown) => void }).set(key, undefined);
			return;
		}
		if (isExtensible(parent)) {
			delete (parent as Record<string, unknown>)[key];
			return;
		}
		if (parentPath) {
			const updated = { ...(parent as Record<string, unknown>) };
			delete updated[key];
			setValueByPath(element, parentPath, updated);
			return;
		}
		setValueByPath(element, path, undefined);
		return;
	}

	if (isStateTreeNode(parent)) {
		(parent as Record<string, unknown>)[key] = next;
		return;
	}

	if (!assignProperty(parent, key, next) && parentPath) {
		setValueByPath(element, parentPath, {
			...(parent as Record<string, unknown>),
			[key]: next,
		});
	}
}

export function appendValueToArrayByPath(element: any, path: string, entry: unknown): void {
	if (!path || !element) {
		return;
	}

	const existing = getValueByPath(element, path);
	if (Array.isArray(existing)) {
		try {
			existing.push(entry);
			return;
		} catch {
			replaceArrayAtPath(element, path, [...existing, entry]);
			return;
		}
	}

	setValueByPath(element, path, [entry]);
}

export function removeValueByPath(element: any, path: string, index: number = NaN) {
	if (!path || !element) return;

	const array = getValueByPath(element, path);
	if (!Array.isArray(array)) return;

	const removeIndex = Number.isNaN(index) ? array.length - 1 : index;
	if (removeIndex < 0 || removeIndex >= array.length) return;

	const entry = array[removeIndex];

	if (isStateTreeNode(entry)) {
		destroy(entry);
		return;
	}

	try {
		array.splice(removeIndex, 1);
		if (array.length === 0) {
			const target = getArrayParent(element, path);
			if (target && !isStateTreeNode(target.parent)) {
				replaceArrayAtPath(element, path, []);
			}
		}
	} catch {
		const next = array.filter((_: unknown, i: number) => i !== removeIndex);
		replaceArrayAtPath(element, path, next);
	}
}

function getMapLikeEntries(value: unknown): [string, unknown][] {
	if (value == null || typeof value !== "object" || Array.isArray(value)) {
		return [];
	}

	if (typeof (value as { get?: unknown }).get === "function" && typeof (value as { keys?: unknown }).keys === "function") {
		const mapLike = value as { keys: () => Iterable<string>; get: (key: string) => unknown };
		return Array.from(mapLike.keys()).map((key) => [key, mapLike.get(key)]);
	}

	return Object.entries(value as Record<string, unknown>);
}

function setMapLikeOrder(element: any, path: string, value: unknown, entries: [string, unknown][]): void {
	if (value != null && typeof (value as { clear?: unknown }).clear === "function" && typeof (value as { set?: unknown }).set === "function") {
		const mapLike = value as { clear: () => void; set: (key: string, val: unknown) => void };
		mapLike.clear();
		for (const [key, entryValue] of entries) {
			mapLike.set(key, entryValue);
		}
		return;
	}

	const newObj: Record<string, unknown> = {};
	for (const [key, entryValue] of entries) {
		newObj[key] = entryValue;
	}
	setValueByPath(element, path, newObj);
}

export function addValueByPath(
	element: IElement,
	_pathPrefix: string,
	path: string,
	schemaItem: ISchemaGroupModel,
	addContextElement: unknown = element
) {
	if (!element || !path || !schemaItem || !isArrayCollectionGroup(schemaItem)) {
		return;
	}

	const entry = buildDefaultEntryFromSchemaItems(schemaItem.items as any, {
		element: addContextElement,
		dataPathPrefix: path,
		siblingArrayPath: path,
	});
	appendValueToArrayByPath(element, path, entry);
}

export function moveArrayEntryByPath(
	element: any,
	path: string,
	fromIndex: number,
	delta: -1 | 1
) {
	if (!path || !element) {
		return;
	}

	const array = getValueByPath(element, path);
	if (!Array.isArray(array)) {
		return;
	}

	const toIndex = fromIndex + delta;
	if (fromIndex < 0 || fromIndex >= array.length || toIndex < 0 || toIndex >= array.length) {
		return;
	}

	const [item] = array.splice(fromIndex, 1);
	array.splice(toIndex, 0, item);
}

export function moveMapEntryByPath(
	element: any,
	path: string,
	key: string,
	delta: -1 | 1
) {
	if (!path || !element) {
		return;
	}

	const value = getValueByPath(element, path);
	const entries = getMapLikeEntries(value);
	const fromIndex = entries.findIndex(([entryKey]) => entryKey === key);
	if (fromIndex < 0) {
		return;
	}

	const toIndex = fromIndex + delta;
	if (toIndex < 0 || toIndex >= entries.length) {
		return;
	}

	const tmp = entries[fromIndex];
	entries[fromIndex] = entries[toIndex];
	entries[toIndex] = tmp;
	setMapLikeOrder(element, path, value, entries);
}

export function findSchemaByPath(schema: any, pathPrefix: string, path: string): any {
	return undefined;
}