import { IAsset } from "../Stores/Models/Asset.Model";
import { resolveAssetElementType } from "./elementDefinitionTypes";
import { isAssetStackRoot, isStackMemberAsset } from "./graphComponentStack";
import { collectContextValues } from "./connectionContextValues";
import { normalizeDockpartType } from "./dockpartBasedOn";

const CONTEXT_COMPONENT_TYPES = new Set(["CONTEXT", "NETWORK", "VLAN", "GROUP"]);

function assetType(asset: IAsset): string {
	return resolveAssetElementType(asset.definition).trim().toUpperCase();
}

function hasVlanOrNetworkDockparts(asset: IAsset): boolean {
	return collectContextValues(asset).some((value) => {
		const type = normalizeDockpartType(value.type);
		return type === "VLAN" || type === "IP";
	});
}

/** Device = Sonderform der Component: Basis / Netzwerk-Stack. */
export function isDeviceComponent(asset: IAsset): boolean {
	return assetType(asset) === "DEVICE";
}

/**
 * Device-Kästchen: type DEVICE, sonst Stack-Wurzel die kein Context ist.
 */
export function isDeviceBox(asset: IAsset, assets: ReadonlyArray<IAsset>): boolean {
	if (isDeviceComponent(asset)) {
		return true;
	}
	return isAssetStackRoot(asset, assets) && !isContextComponent(asset, assets);
}

/** Funktionsblock im Device (SIP, Webserver, …). */
export function isFunctionalComponent(asset: IAsset, assets: ReadonlyArray<IAsset>): boolean {
	if (isDeviceComponent(asset) || isContextComponent(asset, assets)) {
		return false;
	}
	return isStackMemberAsset(asset, assets);
}

/** @deprecated Nutze isFunctionalComponent */
export function isInnerComponent(asset: IAsset, assets: ReadonlyArray<IAsset>): boolean {
	return isFunctionalComponent(asset, assets);
}

/**
 * Context / Zone: Component mit VLAN-/Netz-Dockparts, kein Device und kein Funktionsblock.
 */
export function isContextComponent(asset: IAsset, assets: ReadonlyArray<IAsset> = []): boolean {
	if (isDeviceComponent(asset)) {
		return false;
	}
	if (assets.length > 0 && isStackMemberAsset(asset, assets)) {
		return false;
	}
	if (CONTEXT_COMPONENT_TYPES.has(assetType(asset))) {
		return true;
	}
	return hasVlanOrNetworkDockparts(asset);
}

export function collectContextComponents(assets: ReadonlyArray<IAsset>): IAsset[] {
	return assets.filter((asset) => isContextComponent(asset, assets));
}

export function collectDeviceInnerComponents(
	device: IAsset,
	assets: ReadonlyArray<IAsset>
): IAsset[] {
	const inner: IAsset[] = [];
	const walk = (parent: IAsset) => {
		for (const child of assets) {
			if (child.ownerIdRef !== parent.id) {
				continue;
			}
			inner.push(child);
			walk(child);
		}
	};
	walk(device);
	return inner;
}

export function collectDeviceStackAssets(
	device: IAsset,
	assets: ReadonlyArray<IAsset>
): IAsset[] {
	return [device, ...collectDeviceInnerComponents(device, assets)];
}
