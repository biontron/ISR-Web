import { IAsset } from "../Stores/Models/Asset.Model";
import { IDockpart } from "../Stores/Models/Dock.Model";
import { ContextValueHost, findContextValue } from "./connectionContextValues";
import { connectionLayerColor } from "./connectionLayerColor";

export type GraphDockCircle = {
	dockpartId: string;
	assetId: string;
	color: string;
	title: string;
	type: string;
	valueRef: string;
};

function circleFromDockpart(
	asset: IAsset,
	part: IDockpart,
	hosts: ReadonlyArray<ContextValueHost>
): GraphDockCircle {
	const type = String(part.type || part.protocol || "").trim();
	const valueRef = String(part.valueRef ?? "").trim();
	const resolved = findContextValue(hosts, valueRef);
	return {
		dockpartId: String(part.id),
		assetId: asset.id,
		color: resolved?.color ?? connectionLayerColor(type),
		title: resolved?.label || part.label?.trim() || type || String(part.id),
		type,
		valueRef,
	};
}

export function collectGraphDockCircles(
	asset: IAsset,
	hosts: ReadonlyArray<ContextValueHost>
): GraphDockCircle[] {
	const circles: GraphDockCircle[] = [];
	for (const dock of asset.docks ?? []) {
		for (const part of dock.dockparts ?? []) {
			circles.push(circleFromDockpart(asset, part, hosts));
		}
	}
	return circles;
}

export function renderGraphDockCirclesHtml(circles: GraphDockCircle[]): string {
	if (circles.length === 0) {
		return "";
	}
	const items = circles
		.map(
			(circle) =>
				`<span class="graph-dock-circle" data-dockpart-id="${escapeHtml(circle.dockpartId)}" title="${escapeHtml(circle.title)}" style="background:${circle.color}"></span>`
		)
		.join("");
	return `<div class="graph-dock-circles">${items}</div>`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}
