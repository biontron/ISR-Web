/*
# SPDX-License-Identifier: GPL-2.0*/

import React from "react";

type ElementVisualKind = "VIEW" | "GROUP" | "ASSET" | "UNKNOWN";

interface SchemaSvgIconProps {
	svgString: string | undefined;
	element: {
		class?: string;
		baseType?: string;
		type?: string;
		schemaType?: string;
		elementIdRefs?: unknown[];
	};
}

function resolveElementVisualKind(element: SchemaSvgIconProps["element"]): ElementVisualKind {
	const cls = element.class?.toUpperCase();
	if (cls === "VIEW" || cls === "GROUP" || cls === "ASSET") {
		return cls;
	}

	const baseType = element.baseType?.toUpperCase();
	if (baseType === "GROUP") {
		return "GROUP";
	}
	if (baseType === "COMPONENT") {
		return "ASSET";
	}

	const logicalType = (element.type ?? element.schemaType)?.toUpperCase();
	if (logicalType === "VIEW") {
		return "VIEW";
	}
	if (logicalType === "GROUP") {
		return "GROUP";
	}

	return "UNKNOWN";
}

const SchemaSvgIcon: React.FC<SchemaSvgIconProps> = ({ svgString, element }) => {
	const generateBorderSvg = () => {
		const kind = resolveElementVisualKind(element);
		let isCircle = false;
		let isBox = false;
		let isUnknown = false;

		switch (kind) {
			case "VIEW":
				isCircle = true;
				break;
			case "GROUP":
				isCircle = true;
				if (element.elementIdRefs?.length) {
					isBox = true;
				}
				break;
			case "ASSET":
				isBox = true;
				break;
			default:
				isUnknown = true;
				break;
		}

		let svg =
			"<svg width='100%' height='100%' viewBox='-2 -2 44 44' xmlns='http://www.w3.org/2000/svg'>";
		if (isCircle) {
			svg +=
				"<circle cx='20' cy='20' r='20' stroke='#2F89FF' stroke-width='2' fill='rgba(47, 137, 255, 0.5)' />";
		}
		if (isBox) {
			svg +=
				"<rect x='2' y='2' width='36' height='36' stroke='#FFA52F' stroke-width='2' fill='rgba(255, 165, 47, 0.5)' />";
		}
		if (isUnknown) {
			svg +=
				"<polygon points='10,0 30,0 40,10 40,30 30,40 10,40 0,30 0,10' style='fill:red;stroke:white;stroke-width:2' />";
		}
		svg +=
			"<g transform='translate(6, 6)'><g transform='scale(0.6 0.6)'>" +
			(svgString ?? "") +
			"</g></g>";
		svg += "</svg>";
		return svg;
	};

	const borderSvg = generateBorderSvg();

	return (
		<div dangerouslySetInnerHTML={{ __html: borderSvg }} className={"SchemaSvgIcon"} />
	);
};

export default SchemaSvgIcon;
