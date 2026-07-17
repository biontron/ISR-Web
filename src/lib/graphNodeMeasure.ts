import { select } from "d3-selection";

const NODE_MIN_WIDTH = 60;
const NODE_MIN_HEIGHT = 48;

export function measureGraphNodeSize(node: SVGGElement): { width: number; height: number } {
	let width = NODE_MIN_WIDTH;
	let height = NODE_MIN_HEIGHT;

	const foreignObject = node.querySelector("foreignObject");
	if (foreignObject) {
		const attrW = Number(foreignObject.getAttribute("width"));
		const attrH = Number(foreignObject.getAttribute("height"));
		const div = foreignObject.querySelector("div");
		if (div) {
			width = Math.max(width, div.scrollWidth, div.offsetWidth, attrW || 0);
			height = Math.max(height, div.scrollHeight, div.offsetHeight, attrH || 0);
		} else {
			width = Math.max(width, attrW || 0);
			height = Math.max(height, attrH || 0);
		}
	}

	const rect = node.querySelector("rect.label-container, rect");
	if (rect) {
		width = Math.max(width, Number(rect.getAttribute("width")) || 0);
		height = Math.max(height, Number(rect.getAttribute("height")) || 0);
	}

	try {
		const bbox = node.getBBox();
		width = Math.max(width, bbox.width);
		height = Math.max(height, bbox.height);
	} catch {
		// getBBox fails on empty/hidden nodes
	}

	return { width, height };
}

export function readGraphNodeId(element: Element): string | undefined {
	const attrId = element.getAttribute("id");
	if (attrId) {
		return attrId;
	}
	const datum = select(element).datum();
	if (typeof datum === "string") {
		return datum;
	}
	if (datum && typeof datum === "object" && "id" in datum) {
		return String((datum as { id: string }).id);
	}
	return undefined;
}

/** Dagre-Knoten: Rechteck/Label sind um (0,0) zentriert — translate setzt die Mitte. */
export function resizeGraphNodeBox(node: SVGGElement, width: number, height: number): void {
	const w = Math.max(1, Math.ceil(width));
	const h = Math.max(1, Math.ceil(height));
	const halfW = w / 2;
	const halfH = h / 2;

	const rects =
		node.querySelectorAll("rect.label-container").length > 0
			? node.querySelectorAll("rect.label-container")
			: node.querySelectorAll(":scope > rect");

	rects.forEach((element) => {
		element.setAttribute("x", String(-halfW));
		element.setAttribute("y", String(-halfH));
		element.setAttribute("width", String(w));
		element.setAttribute("height", String(h));
	});

	const foreignObject = node.querySelector("foreignObject");
	if (foreignObject) {
		foreignObject.setAttribute("x", String(-halfW));
		foreignObject.setAttribute("y", String(-halfH));
		foreignObject.setAttribute("width", String(w));
		foreignObject.setAttribute("height", String(h));
	}
}

/** @deprecated use resizeGraphNodeBox */
export function resizeGraphNodeForeignObject(node: SVGGElement, width: number, height: number): void {
	resizeGraphNodeBox(node, width, height);
}

export function applyGraphNodeCenterTransform(
	node: SVGGElement,
	centerX: number,
	centerY: number
): void {
	select(node).attr("transform", `translate(${centerX},${centerY})`);
}
