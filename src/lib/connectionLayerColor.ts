import { normalizeDockpartType } from "./dockpartBasedOn";

export const LAYER_COLOR_VLAN = "#dc2626";
export const LAYER_COLOR_IP = "#7c3aed";
export const LAYER_COLOR_DEFAULT = "#64748b";

export function connectionLayerColor(type: string | undefined | null): string {
	const normalized = normalizeDockpartType(type);
	if (normalized === "VLAN") {
		return LAYER_COLOR_VLAN;
	}
	if (normalized === "IP") {
		return LAYER_COLOR_IP;
	}
	return LAYER_COLOR_DEFAULT;
}
