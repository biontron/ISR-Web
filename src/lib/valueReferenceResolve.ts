import { IAsset } from "../Stores/Models/Asset.Model";
import { collectDockpartValueSnapshot } from "./connectionSnapshot";
import { formatAssetDisplayName } from "./connectionEndpointRef";

export type ValueReference = {
	kind: "componentRef" | "valueRef";
	componentRef: string;
	field?: string;
	labelSnapshot?: string;
};

export function isValueReference(value: unknown): value is ValueReference {
	if (value == null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	const record = value as Record<string, unknown>;
	return (
		(record.kind === "componentRef" || record.kind === "valueRef") &&
		typeof record.componentRef === "string" &&
		record.componentRef.trim() !== ""
	);
}

export function resolveValueReference(
	value: unknown,
	allAssets: IAsset[],
	_consumerAsset?: IAsset
): unknown {
	if (!isValueReference(value)) {
		return value;
	}

	const sourceAsset = allAssets.find((asset) => asset.id === value.componentRef.trim());
	if (!sourceAsset) {
		return value.labelSnapshot ?? value.componentRef;
	}

	if (!value.field?.trim()) {
		return formatAssetDisplayName(sourceAsset);
	}

	for (const dock of sourceAsset.docks) {
		for (const part of dock.dockparts) {
			const settings = collectDockpartValueSnapshot(part);
			if (Object.prototype.hasOwnProperty.call(settings, value.field)) {
				const nested = settings[value.field];
				return resolveValueReference(nested, allAssets, sourceAsset);
			}
		}
	}

	return value.labelSnapshot ?? formatAssetDisplayName(sourceAsset);
}

export function buildValueReference(
	componentRef: string,
	field?: string,
	labelSnapshot?: string
): ValueReference {
	return {
		kind: field ? "valueRef" : "componentRef",
		componentRef,
		field: field?.trim() || undefined,
		labelSnapshot,
	};
}
