import { hoverFieldsFromLiveElement, type ElementDefinitionHoverFields } from "./elementDefinitionHover";
import { readEnvironmentId } from "./environmentIdentity";

export type HoverAnchorRect = {
	left: number;
	top: number;
	right: number;
	width: number;
	height: number;
};

export type HoverOverlaySize = {
	width: number;
	height: number;
};

export type HoverViewport = {
	width: number;
	height: number;
};

const DEFAULT_GAP = 8;
const DEFAULT_MARGIN = 8;

/** Platzierung rechts neben dem Anker, geklemmt ins Fenster — nicht im SVG. */
export function placeFixedHoverOverlay({
	anchor,
	overlay,
	viewport,
	gap = DEFAULT_GAP,
	margin = DEFAULT_MARGIN,
}: {
	anchor: HoverAnchorRect;
	overlay: HoverOverlaySize;
	viewport: HoverViewport;
	gap?: number;
	margin?: number;
}): { left: number; top: number } {
	const maxLeft = Math.max(margin, viewport.width - margin - overlay.width);
	let left = anchor.right + gap;
	if (left > maxLeft) {
		left = anchor.left - gap - overlay.width;
	}
	left = Math.min(maxLeft, Math.max(margin, left));

	const maxTop = Math.max(margin, viewport.height - margin - overlay.height);
	let top = anchor.top;
	if (top > maxTop) {
		top = maxTop;
	}
	top = Math.min(maxTop, Math.max(margin, top));

	return { left, top };
}

type GraphHoverElement = {
	id: string;
	class?: string;
	status?: string;
	environmentId?: string | null;
	definition?: {
		baseType?: string;
		type?: string;
		subType?: string;
		name?: string;
		label?: string;
		description?: string;
	};
};

function environmentName(environment?: { id?: string; definition?: { name?: string } } | null): string | undefined {
	const name = environment?.definition?.name?.trim();
	if (name) {
		return name;
	}
	return environment?.id;
}

type GraphHoverRoot = {
	assets: { assets: readonly GraphHoverElement[] };
	groups: { groups: readonly GraphHoverElement[] };
	views: { views: readonly GraphHoverElement[] };
	environments: { findById: (id: string) => { id?: string; definition?: { name?: string } } | null | undefined };
};

export function resolveGraphNodeHoverFields(
	root: GraphHoverRoot,
	nodeId: string
): ElementDefinitionHoverFields | undefined {
	const trimmed = nodeId.trim();
	if (!trimmed) {
		return undefined;
	}
	const element =
		root.assets.assets.find((item) => item.id === trimmed) ??
		root.groups.groups.find((item) => item.id === trimmed) ??
		root.views.views.find((item) => item.id === trimmed);
	if (!element) {
		return undefined;
	}
	const environmentId = readEnvironmentId(element);
	const environment = environmentId ? root.environments.findById(environmentId) : undefined;
	return hoverFieldsFromLiveElement(
		{
			id: element.id,
			class: element.class,
			status: element.status,
			environmentId,
			definition: element.definition,
		},
		{ environment: environmentName(environment) }
	);
}
