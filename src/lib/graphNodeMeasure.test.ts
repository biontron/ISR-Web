import { measureGraphNodeLabelSize, resizeGraphNodeBox } from "./graphNodeMeasure";

function svgNode(html: string): SVGGElement {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.innerHTML = html;
	return svg.firstElementChild as SVGGElement;
}

describe("measureGraphNodeLabelSize", () => {
	it("misst nur das eigene Label, nicht verschachtelte Nodes", () => {
		const node = svgNode(`
			<g class="node graph-device-shell">
				<g class="label">
					<g>
						<foreignObject width="400" height="200">
							<div class="graph-node-shell" style="width:max-content">DeviceTitle</div>
						</foreignObject>
					</g>
				</g>
				<g class="node graph-nested-component">
					<g class="label">
						<g>
							<foreignObject width="300" height="80">
								<div class="graph-node-shell">NestedFunctionThatIsMuchWiderThanNeededXXXX</div>
							</foreignObject>
						</g>
					</g>
				</g>
			</g>
		`);
		const size = measureGraphNodeLabelSize(node);
		expect(size.width).toBeLessThan(400);
		expect(size.height).toBeLessThan(200);
	});
});

describe("resizeGraphNodeBox", () => {
	it("setzt die Titelleiste oben links auf Labelbreite", () => {
		const node = svgNode(`
			<g class="node">
				<rect class="label-container" x="-10" y="-10" width="20" height="20"></rect>
				<g class="label" transform="translate(-40,-20)">
					<g transform="translate(-30,-10)">
						<foreignObject x="0" y="0" width="80" height="40"></foreignObject>
					</g>
				</g>
			</g>
		`);
		resizeGraphNodeBox(node, 200, 100, { titleBarHeight: 24, titleBarWidth: 80 });
		const rect = node.querySelector("rect.label-container") as SVGRectElement;
		expect(rect.getAttribute("width")).toBe("200");
		expect(rect.getAttribute("height")).toBe("100");
		expect(rect.getAttribute("x")).toBe("-100");
		expect(rect.getAttribute("y")).toBe("-50");
		const fo = node.querySelector("foreignObject") as SVGForeignObjectElement;
		expect(fo.getAttribute("x")).toBe("-100");
		expect(fo.getAttribute("y")).toBe("-50");
		expect(fo.getAttribute("width")).toBe("80");
		expect(fo.getAttribute("height")).toBe("24");
		expect(node.querySelector(":scope > g.label")?.getAttribute("transform")).toBeNull();
	});
});
