import { IAsset } from "../Stores/Models/Asset.Model";
import { IDockpart } from "../Stores/Models/Dock.Model";
import { IGroup } from "../Stores/Models/Group.Model";
import { collectDockpartValueSnapshot, ValueSnapshotMap } from "./connectionSnapshot";
import { resolveValueReference } from "./valueReferenceResolve";

/**
 * Positionierung einer Component in einer Kontext-Gruppe (VLAN, Netzwerk, …).
 * Kontext ist keine Component — es werden nur referenzierte Feldwerte übernommen,
 * nicht der Dockpart-Stack der Gruppe. Siehe Documents/Connection-Stack-Architektur.md
 */
export type ContextMembership = {
	contextGroupRef: string;
	contextLabelSnapshot?: string;
};

export type EffectiveDockpart = IDockpart & {
	sourceAssetId?: string;
};

export type EffectiveDock = {
	id: string;
	type?: string;
	label?: string;
	dockparts: EffectiveDockpart[];
	ownerType?: "COMPONENT";
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
	allAssets: IAsset[],
	allGroups: IGroup[]
): ValueSnapshotMap {
	const raw = collectDockpartValueSnapshot(part);
	const resolved: ValueSnapshotMap = {};
	const memberships = asset.contextMemberships?.slice() ?? [];

	for (const [key, value] of Object.entries(raw)) {
		resolved[key] = resolveValueReference(value, {
			assets: allAssets,
			groups: allGroups,
			contextMemberships: memberships,
		});
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

/**
 * Liefert die Docks einer Component mit aufgelösten Settings (inkl. contextValueRef).
 * Kontext-Gruppen liefern keine zusätzlichen Dockparts — nur Werte in den Settings.
 */
export function getEffectiveDocks(
	asset: IAsset,
	allAssets: IAsset[],
	allGroups: IGroup[] = []
): EffectiveDock[] {
	return asset.docks.map((dock) => ({
		id: String(dock.id),
		type: dock.type,
		label: dock.label,
		dockparts: dock.dockparts.map((part) => {
			const cloned = cloneDockpart(part, { sourceAssetId: asset.id });
			return applyResolvedSettings(
				cloned,
				resolveEffectiveSettings(part, asset, allAssets, allGroups)
			);
		}),
		ownerType: "COMPONENT" as const,
		ownerRef: asset.id,
	}));
}

export function getEffectiveDockpartsForAsset(
	asset: IAsset,
	allAssets: IAsset[],
	allGroups: IGroup[] = []
): EffectiveDockpart[] {
	return getEffectiveDocks(asset, allAssets, allGroups).flatMap((dock) => dock.dockparts);
}

export function formatContextMembershipLabel(membership: ContextMembership, groups: IGroup[]): string {
	const group = groups.find((entry) => entry.id === membership.contextGroupRef);
	if (group) {
		return group.definition?.label?.trim() || group.definition?.name?.trim() || group.id;
	}
	return membership.contextLabelSnapshot?.trim() || membership.contextGroupRef;
}

export function formatEffectiveDockpartLabel(dockpart: EffectiveDockpart | IDockpart): string {
	return dockpart.label || dockpart.protocol || dockpart.type || String(dockpart.id);
}

/** @deprecated Kontext erzeugt keine geerbten Dockparts — nur Werte in Settings. Immer false. */
export function isInheritedDockpart(_dockpart: EffectiveDockpart | IDockpart): boolean {
	return false;
}
