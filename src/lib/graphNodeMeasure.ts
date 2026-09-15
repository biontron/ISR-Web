import { select } from "d3-selection";

const NODE_MIN_WIDTH = 60;
const NODE_MIN_HEIGHT = 48;
const LABEL_MIN_WIDTH = 24;
const LABEL_MIN_HEIGHT = 16;

/** Dagre legt HTML-Labels unter `g.label`, nicht direkt in `g.node`. */
function ownForeignObject(node: SVGGElement): SVGForeignObjectElement | null {
	return (
		(node.querySelector(":scope > g.label foreignObject") as SVGForeignObjectElement | null) ??
		(node.querySelector(":scope > foreignObject") as SVGForeignObjectElement | null)
	);
}

function pinLabelToTopLeft(node: SVGGElement): void {
	const labelGroup = node.querySelector(":scope > g.label") as SVGGElement | null;
	if (!labelGroup) {
		return;
	}
	labelGroup.removeAttribute("transform");
	const inner = labelGroup.querySelector(":scope > g") as SVGGElement | null;
	if (inner) {
		inner.removeAttribute("transform");
	}
}

export function measureGraphNodeSize(node: SVGGElement): { width: number; height: number } {
	let width = NODE_MIN_WIDTH;
	let height = NODE_MIN_HEIGHT;

	const foreignObject = ownForeignObject(node);
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

	const rect = node.querySelector(":scope > rect.label-container, :scope > rect:not(.graph-component-titlebar)");
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

/**
 * Nur Icon+Name+Docks — nicht Rect, getBBox oder schon vergrößerte Shell.
 * Nach dem Nesten innerer Nodes darf die Device-Gruppe nicht mitgemessen werden.
 */
export function measureGraphNodeLabelSize(node: SVGGElement): { width: number; height: number } {
	const foreignObject = ownForeignObject(node);
	if (!foreignObject) {
		return { width: LABEL_MIN_WIDTH, height: LABEL_MIN_HEIGHT };
	}

	const shell =
		(foreignObject.querySelector(".graph-node-shell") as HTMLElement | null) ??
		(foreignObject.querySelector("div") as HTMLElement | null);
	if (!shell) {
		return { width: LABEL_MIN_WIDTH, height: LABEL_MIN_HEIGHT };
	}

	const prevWidth = shell.style.width;
	const prevMaxWidth = shell.style.maxWidth;
	shell.style.width = "max-content";
	shell.style.maxWidth = "none";
	const width = Math.max(
		LABEL_MIN_WIDTH,
		Math.ceil(Math.max(shell.scrollWidth, shell.offsetWidth, shell.clientWidth))
	);
	const height = Math.max(
		LABEL_MIN_HEIGHT,
		Math.ceil(Math.max(shell.scrollHeight, shell.offsetHeight, shell.clientHeight))
	);
	shell.style.width = prevWidth;
	shell.style.maxWidth = prevMaxWidth;
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

export type ResizeGraphNodeBoxOptions = {
	/** Titelleiste oben; foreignObject bleibt auf dieser Höhe, Rect umschließt den ganzen Kasten. */
	titleBarHeight?: number;
	/** Titelleiste links; kleiner als die Box, damit Name oben links sitzt. */
	titleBarWidth?: number;
};

const TITLEBAR_RECT_SELECTOR = ":scope > rect:not(.graph-component-titlebar)";

/** Dagre-Knoten: Rechteck/Label sind um (0,0) zentriert — translate setzt die Mitte. */
export function resizeGraphNodeBox(
	node: SVGGElement,
	width: number,
	height: number,
	options?: ResizeGraphNodeBoxOptions
): void {
	const w = Math.max(1, Math.ceil(width));
	const h = Math.max(1, Math.ceil(height));
	const halfW = w / 2;
	const halfH = h / 2;
	const titleBarHeight = options?.titleBarHeight
		? Math.max(1, Math.min(Math.ceil(options.titleBarHeight), h))
		: h;
	const titleBarWidth = options?.titleBarWidth
		? Math.max(1, Math.min(Math.ceil(options.titleBarWidth), w))
		: w;

	const labeled = node.querySelectorAll(":scope > rect.label-container");
	const rects = labeled.length > 0 ? labeled : node.querySelectorAll(TITLEBAR_RECT_SELECTOR);

	rects.forEach((element) => {
		element.setAttribute("x", String(-halfW));
		element.setAttribute("y", String(-halfH));
		element.setAttribute("width", String(w));
		element.setAttribute("height", String(h));
	});

	if (options?.titleBarHeight != null || options?.titleBarWidth != null) {
		pinLabelToTopLeft(node);
	}

	const foreignObject = ownForeignObject(node);
	if (foreignObject) {
		foreignObject.setAttribute("x", String(-halfW));
		foreignObject.setAttribute("y", String(-halfH));
		foreignObject.setAttribute("width", String(titleBarWidth));
		foreignObject.setAttribute("height", String(titleBarHeight));
	}
}

/** Cluster-/Node-HTML-Label auf einzeilige Textbreite ziehen, damit Namen nicht umbrechen. */
export function fitGraphHtmlLabelWidth(
	host: SVGGElement,
	minWidth = 0
): { width: number; height: number } {
	const foreignObject = ownForeignObject(host);
	if (!foreignObject) {
		return { width: minWidth, height: 0 };
	}

	const shell =
		(foreignObject.querySelector(".graph-node-shell") as HTMLElement | null) ??
		(foreignObject.querySelector("div") as HTMLElement | null);
	if (!shell) {
		const attrW = Number(foreignObject.getAttribute("width")) || 0;
		const attrH = Number(foreignObject.getAttribute("height")) || 0;
		return { width: Math.max(minWidth, attrW), height: attrH };
	}

	const prevWidth = shell.style.width;
	const prevMaxWidth = shell.style.maxWidth;
	const prevWhiteSpace = shell.style.whiteSpace;
	shell.style.width = "max-content";
	shell.style.maxWidth = "none";
	shell.style.whiteSpace = "nowrap";
	const width = Math.max(
		minWidth,
		Math.ceil(Math.max(shell.scrollWidth, shell.offsetWidth, shell.clientWidth))
	);
	const height = Math.max(
		1,
		Math.ceil(Math.max(shell.scrollHeight, shell.offsetHeight, shell.clientHeight))
	);
	shell.style.width = prevWidth;
	shell.style.maxWidth = prevMaxWidth;
	shell.style.whiteSpace = prevWhiteSpace;
	foreignObject.setAttribute("width", String(width));
	foreignObject.setAttribute("height", String(height));
	return { width, height };
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
