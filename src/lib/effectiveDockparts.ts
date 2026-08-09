import { IAsset } from "../Stores/Models/Asset.Model";
import { IDock, IDockpart } from "../Stores/Models/Dock.Model";
import { formatAssetDisplayName } from "./connectionEndpointRef";
import { collectDockpartValueSnapshot, ValueSnapshotMap } from "./connectionSnapshot";
import { resolveValueReference } from "./valueReferenceResolve";

export type ContextMembership = {
	contextRef: string;
	contextLabelSnapshot?: string;
};

export type EffectiveDockpart = IDockpart & {
	isInherited?: boolean;
	inheritedFromContextRef?: string;
	inheritedFromDockpartRef?: string;
	inheritedContextLabelSnapshot?: string;
	sourceAssetId?: string;
};

export type EffectiveDock = {
	id: string;
	type?: string;
	label?: string;
	dockparts: EffectiveDockpart[];
	ownerType?: "COMPONENT" | "CONTEXT";
	ownerRef?: string;
};

function cloneDockpart(part: IDockpart, overrides: Partial<EffectiveDockpart> = {}): EffectiveDockpart {
	const settingsEntries: [string, unknown][] = [];
	if (part.settings && typeof part.settings.forEach === "function") {
		part.settings.forEach((value, key) => settingsEntries.push([String(key), value]));
	}

	const schemaExtensionEntries: [string, unknown][] = [];
	if (part.schemaExtensions && typeof part.schemaExtensions.forEach === "function") {
		part.schemaExtensions.forEach((value, key) => schemaExtensionEntries.push([String(key), value]));
	}

	return {
		id: part.id,
		type: part.type,
		label: part.label,
		protocol: part.protocol,
		versions: part.versions?.slice() ?? [],
		basedOn: part.basedOn?.slice() ?? [],
		settings: new Map(settingsEntries) as IDockpart["settings"],
		schemaExtensions: new Map(schemaExtensionEntries) as IDockpart["schemaExtensions"],
		...overrides,
	} as EffectiveDockpart;
}

function resolveEffectiveSettings(
	part: IDockpart,
	asset: IAsset,
	allAssets: IAsset[]
): ValueSnapshotMap {
	const raw = collectDockpartValueSnapshot(part);
	const resolved: ValueSnapshotMap = {};

	for (const [key, value] of Object.entries(raw)) {
		resolved[key] = resolveValueReference(value, allAssets, asset);
	}

	return resolved;
}

function applyResolvedSettings(part: EffectiveDockpart, resolved: ValueSnapshotMap): EffectiveDockpart {
	const settings = new Map<string, unknown>();
	for (const [key, value] of Object.entries(resolved)) {
		settings.set(key, value);
	}
	return {
		...part,
		settings: settings as IDockpart["settings"],
	};
}

export function getEffectiveDocks(asset: IAsset, allAssets: IAsset[]): EffectiveDock[] {
	const effectiveDocks: EffectiveDock[] = asset.docks.map((dock) => ({
		id: String(dock.id),
		type: dock.type,
		label: dock.label,
		dockparts: dock.dockparts.map((part) => {
			const cloned = cloneDockpart(part, { sourceAssetId: asset.id });
			return applyResolvedSettings(cloned, resolveEffectiveSettings(part, asset, allAssets));
		}),
		ownerType: "COMPONENT" as const,
		ownerRef: asset.id,
	}));

	const memberships = ((asset as IAsset & { contextMemberships?: ContextMembership[] }).contextMemberships ??
		[]) as ContextMembership[];

	for (const membership of memberships) {
		const contextAsset = allAssets.find((entry) => entry.id === membership.contextRef);
		if (!contextAsset) {
			continue;
		}

		for (const contextDock of contextAsset.docks) {
			for (const contextPart of contextDock.dockparts) {
				const inheritedPart = cloneDockpart(contextPart, {
					isInherited: true,
					inheritedFromContextRef: contextAsset.id,
					inheritedFromDockpartRef: String(contextPart.id),
					inheritedContextLabelSnapshot:
						membership.contextLabelSnapshot?.trim() || formatAssetDisplayName(contextAsset),
					sourceAssetId: contextAsset.id,
				});
				const resolved = resolveEffectiveSettings(contextPart, contextAsset, allAssets);
				const withValues = applyResolvedSettings(inheritedPart, resolved);

				let targetDock = effectiveDocks.find((dock) => dock.type === contextDock.type);
				if (!targetDock) {
					targetDock = {
						id: `inherited-${contextDock.id}`,
						type: contextDock.type,
						label: contextDock.label,
						dockparts: [],
						ownerType: "CONTEXT",
						ownerRef: contextAsset.id,
					};
					effectiveDocks.push(targetDock);
				}

				targetDock.dockparts.push(withValues);
			}
		}
	}

	return effectiveDocks;
}

export function getEffectiveDockpartsForAsset(asset: IAsset, allAssets: IAsset[]): EffectiveDockpart[] {
	return getEffectiveDocks(asset, allAssets).flatMap((dock) => dock.dockparts);
}

export function isInheritedDockpart(dockpart: EffectiveDockpart | IDockpart): boolean {
	return !!(dockpart as EffectiveDockpart).isInherited;
}

export function formatEffectiveDockpartLabel(dockpart: EffectiveDockpart | IDockpart): string {
	const inherited = (dockpart as EffectiveDockpart).isInherited
		? ` (geerbt aus ${(dockpart as EffectiveDockpart).inheritedContextLabelSnapshot ?? "Kontext"})`
		: "";
	return `${dockpart.label || dockpart.protocol || dockpart.type || dockpart.id}${inherited}`;
}
