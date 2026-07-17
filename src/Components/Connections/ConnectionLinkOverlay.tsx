import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Select } from "antd";
import {
	ConnectionDirection,
	connectionDirectionSelectOptions,
	resolveConnectionDirection,
	resolveConnectionDirectionMarkers,
} from "../../lib/connectionDirection";
import { WizardDockpartMatch, wizardMatchId } from "../../lib/connectionWizardMatches";
import { buildWizardNodeRefId, ConnectionWizardNodeRefId } from "./ConnectionWizardColumn";

type LineSegment = {
	id: string;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	active: boolean;
};

type ConnectionLinkOverlayProps = {
	containerRef: React.RefObject<HTMLElement | null>;
	nodeRefs: Map<ConnectionWizardNodeRefId, HTMLElement>;
	matches: WizardDockpartMatch[];
	activeMatchIds: Set<string>;
	direction: ConnectionDirection | string;
	onDirectionChange: (direction: ConnectionDirection) => void;
	layoutKey?: string;
};

const DIRECTION_OPTIONS = connectionDirectionSelectOptions();

function computeAnchor(
	containerRect: DOMRect,
	element: HTMLElement,
	side: "left" | "right"
): { x: number; y: number } {
	const rect = element.getBoundingClientRect();
	return {
		x: side === "left" ? rect.right - containerRect.left : rect.left - containerRect.left,
		y: rect.top + rect.height / 2 - containerRect.top,
	};
}

const ConnectionLinkOverlay: React.FC<ConnectionLinkOverlayProps> = ({
	containerRef,
	nodeRefs,
	matches,
	activeMatchIds,
	direction: directionInput,
	onDirectionChange,
	layoutKey = "",
}) => {
	const direction = resolveConnectionDirection(
		typeof directionInput === "string" ? directionInput : directionInput
	);
	const [segments, setSegments] = useState<LineSegment[]>([]);
	const [selectPos, setSelectPos] = useState<{ left: number; top: number } | null>(null);
	const svgRef = useRef<SVGSVGElement>(null);
	const markers = resolveConnectionDirectionMarkers(
		direction,
		"connection-arrow-start",
		"connection-arrow-end"
	);

	const recompute = useCallback(() => {
		const container = containerRef.current;
		if (!container) {
			setSegments([]);
			setSelectPos(null);
			return;
		}

		const containerRect = container.getBoundingClientRect();
		const nextSegments: LineSegment[] = [];

		matches.forEach((match) => {
			const fromPart = nodeRefs.get(buildWizardNodeRefId("from", match.from));
			const toPart = nodeRefs.get(buildWizardNodeRefId("to", match.to));
			if (!fromPart || !toPart) {
				return;
			}
			const start = computeAnchor(containerRect, fromPart, "left");
			const end = computeAnchor(containerRect, toPart, "right");
			const id = wizardMatchId(match);
			nextSegments.push({
				id,
				x1: start.x,
				y1: start.y,
				x2: end.x,
				y2: end.y,
				active: activeMatchIds.has(id),
			});
		});

		if (nextSegments.length > 0) {
			const activeSegments = nextSegments.filter((segment) => segment.active);
			const basis = activeSegments.length > 0 ? activeSegments : nextSegments;
			const avgY =
				basis.reduce((sum, segment) => sum + (segment.y1 + segment.y2) / 2, 0) / basis.length;
			const avgX =
				basis.reduce((sum, segment) => sum + (segment.x1 + segment.x2) / 2, 0) / basis.length;
			setSelectPos({ left: avgX, top: avgY });
		} else {
			setSelectPos(null);
		}

		setSegments(nextSegments);
	}, [containerRef, nodeRefs, matches, activeMatchIds, layoutKey]);

	useLayoutEffect(() => {
		recompute();
		const container = containerRef.current;
		if (!container) {
			return undefined;
		}
		const observer = new ResizeObserver(() => recompute());
		observer.observe(container);
		window.addEventListener("resize", recompute);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", recompute);
		};
	}, [containerRef, recompute]);

	return (
		<div className="connection-selection-overlay">
			<svg ref={svgRef} className="connection-selection-overlay__svg">
				<defs>
					<marker
						id="connection-arrow-end"
						markerWidth="8"
						markerHeight="8"
						refX="6"
						refY="3"
						orient="auto"
						markerUnits="strokeWidth"
					>
						<path d="M0,0 L0,6 L6,3 z" fill="#1677ff" />
					</marker>
					<marker
						id="connection-arrow-start"
						markerWidth="8"
						markerHeight="8"
						refX="0"
						refY="3"
						orient="auto"
						markerUnits="strokeWidth"
					>
						<path d="M6,0 L6,6 L0,3 z" fill="#1677ff" />
					</marker>
				</defs>
				{segments.map((segment) => {
					const stroke = segment.active ? "#1677ff" : "#91caff";
					const width = segment.active ? 2.5 : 1.5;
					return (
						<line
							key={segment.id}
							x1={segment.x1}
							y1={segment.y1}
							x2={segment.x2}
							y2={segment.y2}
							stroke={stroke}
							strokeWidth={width}
							strokeOpacity={segment.active ? 0.95 : 0.55}
							strokeDasharray={segment.active ? markers.strokeDasharray : "4 4"}
							markerStart={segment.active ? markers.markerStart : undefined}
							markerEnd={segment.active ? markers.markerEnd : undefined}
						/>
					);
				})}
			</svg>
			{selectPos ? (
				<div
					className="connection-selection-overlay__direction"
					style={{ left: selectPos.left, top: selectPos.top }}
				>
					<Select
						size="small"
						value={direction}
						onChange={onDirectionChange}
						options={DIRECTION_OPTIONS}
						popupMatchSelectWidth={false}
					/>
				</div>
			) : null}
		</div>
	);
};

export default ConnectionLinkOverlay;
