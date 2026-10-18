import { useState } from "react";
import { observer } from "mobx-react";
import { useNavigate } from "react-router-dom";
import { rootStore } from "../../../Stores/Root.Store";
import authStore from "../../../Stores/Auth.Store";
import type { GraphArchitectureRepresentation, GraphCellBlock } from "../../../lib/graphConfig";
import { graphText, presentId, presentPaint, readPreviewMembers, readTagStrings } from "../../../lib/graphConfig";
import { readElementGraphTags } from "../../../lib/graphElementStyle";
import { collectConnectionGraphEdges } from "../../../lib/graphConnectionEdges";
import {
	assignMembersToBlocks,
	layoutArchitecture,
	regionHeadingText,
	visibleArchitectureEdges,
	type ArchitectureMember,
	type PlacedBlock,
} from "../../../lib/graphArchitectureLayout";

type ElementGraphArchitectureProps = {
	architecture: GraphArchitectureRepresentation;
	architectures: GraphArchitectureRepresentation[];
	zoomLevel: number;
	onOpenArchitecture: (architectureId: string) => void;
};

function membersOf(blockMembers: ArchitectureMember[] | undefined, block: GraphCellBlock): ArchitectureMember[] {
	if (blockMembers && blockMembers.length > 0) {
		return blockMembers;
	}
	return readPreviewMembers(block.previewMembers).map((member) => ({
		id: member.id,
		label: graphText(member.label) || member.id,
		tags: [],
	}));
}

function blockSubtitle(block: GraphCellBlock): string {
	const text = graphText(block.text).trim();
	if (text) {
		return text;
	}
	const label = graphText(block.label).trim();
	if (label === "Core Services API") {
		return "API Contracts: OpenAPI • Events • Versionierung";
	}
	if (label === "Prozess Orchestration" || label === "Process Orchestration") {
		return "(BPM Workflow Engine)";
	}
	if (label === "Interface Contract") {
		return "(Spezifikation und Dokumentation)";
	}
	return "";
}

function frameHeading(block: GraphCellBlock): string {
	const label = graphText(block.label).trim();
	if (label) {
		return label;
	}
	const header = graphText(block.header).trim();
	if (header === "Mitarbeiter · Web User") {
		return "Makler Portal";
	}
	if (header === "Web User · Bike") {
		return "Bike Portal";
	}
	if (header === "Web User · Xyz" || header === "Web User · XYZ") {
		return "Portal XYZ";
	}
	if (header.includes("·")) {
		return "";
	}
	return header;
}

function cPath(host: PlacedBlock, nodes: PlacedBlock[]): string {
	const guests = nodes.filter((item) => {
		if (item.block.id === host.block.id) {
			return false;
		}
		const verticallyInside = item.y > host.y + 4 && item.y + item.height < host.y + host.height - 4;
		const startsInside = item.x > host.x + 8 && item.x < host.x + host.width;
		return verticallyInside && startsInside;
	});
	const outer = `M ${host.x} ${host.y} H ${host.x + host.width} V ${host.y + host.height} H ${host.x} Z`;
	if (guests.length === 0) {
		return outer;
	}
	const notchX = Math.min(...guests.map((item) => item.x)) - 8;
	const notchY = Math.min(...guests.map((item) => item.y)) - 8;
	const notchBottom = Math.max(...guests.map((item) => item.y + item.height)) + 8;
	const notch = `M ${notchX} ${notchY} H ${host.x + host.width} V ${notchBottom} H ${notchX} Z`;
	return `${outer} ${notch}`;
}

function frameDirectlyBelow(frame: PlacedBlock, frames: PlacedBlock[]): PlacedBlock | undefined {
	return frames.find(
		(other) =>
			other.block.id !== frame.block.id &&
			other.range.c1 === frame.range.c1 &&
			other.range.c2 === frame.range.c2 &&
			other.range.r1 === frame.range.r2 + 1
	);
}

function continuedFrame(frame: PlacedBlock, frames: PlacedBlock[]): PlacedBlock {
	let bottom = frame.y + frame.height;
	let cursor = frame;
	const seen = new Set<string>([frame.block.id]);
	for (;;) {
		const below = frameDirectlyBelow(cursor, frames);
		if (!below || seen.has(below.block.id)) {
			break;
		}
		seen.add(below.block.id);
		bottom = below.y + below.height;
		cursor = below;
	}
	return { ...frame, height: bottom - frame.y };
}

function blockDash(block: GraphCellBlock): string | undefined {
	const custom = presentPaint(block.strokeDasharray);
	if (custom) {
		return custom;
	}
	return block.dashed === true ? "5 4" : undefined;
}

function markerIdFor(color: string): string {
	let hash = 0;
	for (let index = 0; index < color.length; index += 1) {
		hash = (hash * 31 + color.charCodeAt(index)) >>> 0;
	}
	return `arch-arrow-${hash}`;
}

function arrowMarkers(edges: { lineColor?: string; arrowColor?: string }[]): { id: string; color: string }[] {
	const seen = new Set<string>();
	const markers: { id: string; color: string }[] = [];
	for (const edge of edges) {
		const color = edge.arrowColor || edge.lineColor || "#666";
		const id = markerIdFor(color);
		if (seen.has(id)) {
			continue;
		}
		seen.add(id);
		markers.push({ id, color });
	}
	return markers;
}

export const ElementGraphArchitecture = observer(function ElementGraphArchitecture({
	architecture,
	architectures,
	zoomLevel,
	onOpenArchitecture,
}: ElementGraphArchitectureProps) {
	const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
	const [missingId, setMissingId] = useState<string | null>(null);
	const navigate = useNavigate();
	const assets = rootStore.assets.assets;
	const connections = rootStore.connections.connections;

	// Hashtags liegen an den Assets. Die Zuordnung muss bei jedem Render neu lesen,
	// sonst bleibt die Liste stehen, wenn Tags ergänzt werden oder Assets nachladen.
	const members: ArchitectureMember[] = [];
	for (const asset of assets) {
		if (asset.class !== "Asset" && asset.class !== "AssetDetails") {
			continue;
		}
		members.push({
			id: asset.id,
			label: asset.definition?.name || asset.id,
			tags: readElementGraphTags(asset),
		});
	}

	const assignment = assignMembersToBlocks(architecture.blocks, members);

	const memberCounts = new Map<string, number>();
	for (const block of architecture.blocks) {
		memberCounts.set(block.id, membersOf(assignment.byBlock.get(block.id), block).length);
	}

	const layout = layoutArchitecture(architecture, { expandedIds, memberCounts });

	const memberToBlock = new Map<string, string>();
	assignment.byBlock.forEach((blockMembers, blockId) => {
		blockMembers.forEach((member) => {
			memberToBlock.set(member.id, blockId);
		});
	});

	const visibleMemberIds = new Set<string>();
	memberToBlock.forEach((_blockId, memberId) => {
		visibleMemberIds.add(memberId);
	});
	const connectionPairs =
		visibleMemberIds.size === 0
			? []
			: collectConnectionGraphEdges(Array.from(assets), Array.from(connections), visibleMemberIds).map(
					(edge) => ({ fromId: edge.fromNodeId, toId: edge.toNodeId })
				);

	const membersByBlock = new Map<string, string[]>();
	for (const block of architecture.blocks) {
		membersByBlock.set(
			block.id,
			membersOf(assignment.byBlock.get(block.id), block).map((member) => member.id)
		);
	}

	const edges = visibleArchitectureEdges(
		layout.placed,
		architecture.edges,
		connectionPairs,
		memberToBlock,
		expandedIds,
		membersByBlock
	);

	const regions = layout.placed.filter((item) => (item.block.role ?? "node") === "region");
	const frames = layout.placed.filter((item) => item.block.role === "frame");
	const nodes = layout.placed.filter((item) => (item.block.role ?? "node") === "node");
	const errors = [...layout.errors, ...assignment.errors];
	if (missingId) {
		errors.push(`Architektur für ${missingId} fehlt`);
	}

	function openOrToggle(blockId: string, architectureId?: string) {
		const detailId = presentId(architectureId);
		if (detailId) {
			const target = architectures.find((entry) => entry.id === detailId);
			if (!target) {
				setMissingId(blockId);
				return;
			}
			setMissingId(null);
			onOpenArchitecture(detailId);
			return;
		}
		setExpandedIds((current) => {
			const next = new Set(current);
			if (next.has(blockId)) {
				next.delete(blockId);
			} else {
				next.add(blockId);
			}
			return next;
		});
	}

	function openComponent(event: React.MouseEvent, componentId: string) {
		event.preventDefault();
		event.stopPropagation();
		const viewId = rootStore.ui.activeView?.id;
		if (!viewId) {
			return;
		}
		navigate(`/${authStore.getDomain()}/am/${viewId}/element/${componentId}`);
	}

	return (
		<div className="graph-canvas graph-canvas--architecture">
			{errors.length > 0 && (
				<div className="graph-architecture-errors" role="status">
					{errors.join(" · ")}
				</div>
			)}
			<div className="graph-canvas__viewport">
				<svg
					className="graph-canvas__svg"
					width={layout.width * zoomLevel}
					height={layout.height * zoomLevel}
					viewBox={`0 0 ${layout.width} ${layout.height}`}
				>
					<defs>
						{arrowMarkers([
							...edges,
							...layout.lineLabels.map((label) => ({
								lineColor: label.color,
								arrowColor: label.color,
							})),
						]).map((marker) => (
							<marker
								key={marker.id}
								id={marker.id}
								markerWidth="8"
								markerHeight="8"
								refX="7"
								refY="3"
								orient="auto"
							>
								<path d="M0,0 L8,3 L0,6 Z" fill={marker.color} />
							</marker>
						))}
					</defs>
					<g>
						{regions.map((item) => {
							const fill = presentPaint(item.block.fill);
							if (fill === "transparent") {
								return null;
							}
							return (
								<rect
									key={item.block.id}
									x={item.x}
									y={item.y}
									width={item.width}
									height={item.height}
									rx={6}
									fill={fill || "#f5f5f5"}
									stroke={presentPaint(item.block.stroke) || "#ccc"}
									strokeDasharray={blockDash(item.block)}
								/>
							);
						})}
						{frames
							.filter((item) => !frames.some((other) => frameDirectlyBelow(other, frames)?.block.id === item.block.id))
							.map((item) => {
								const box = continuedFrame(item, frames);
								const dashed = blockDash(item.block);
								return (
									<rect
										key={item.block.id}
										x={box.x}
										y={box.y}
										width={box.width}
										height={box.height}
										rx={4}
										fill={presentPaint(item.block.fill) || (dashed ? "rgba(255,255,255,0.5)" : "transparent")}
										stroke={presentPaint(item.block.stroke) || "#4466aa"}
										strokeDasharray={dashed}
									/>
								);
							})}
						{edges.map((edge) => {
							const lineColor = edge.lineColor || "#666";
							const arrowColor = edge.arrowColor || lineColor;
							const marker = markerIdFor(arrowColor);
							return (
								<line
									key={edge.key}
									x1={edge.fromX}
									y1={edge.fromY}
									x2={edge.toX}
									y2={edge.toY}
									stroke={lineColor}
									strokeWidth={1.4}
									markerEnd={`url(#${marker})`}
									markerStart={edge.bidirectional ? `url(#${marker})` : undefined}
								/>
							);
						})}
						{nodes.map((item) => {
							const expanded = expandedIds.has(item.block.id);
							const detailId = presentId(item.block.architectureId);
							const linkedMembers = assignment.byBlock.get(item.block.id) ?? [];
							const shown = membersOf(linkedMembers, item.block);
							const linked = linkedMembers.length > 0;
							const label = graphText(item.block.label).trim();
							const caption = blockSubtitle(item.block);
							const previewCount = expanded && !detailId ? 6 : 3;
							const preview = shown.slice(0, previewCount);
							const tagLine =
								preview.length === 0 ? readTagStrings(item.block.tags).join(", ") : "";
							const clickable = Boolean(detailId) || shown.length > 0 || Boolean(label);
							const stroke = missingId === item.block.id ? "#c62828" : presentPaint(item.block.stroke) || "#333";
							const dash = blockDash(item.block);
							return (
								<g
									key={item.block.id}
									className="graph-architecture-block"
									style={{ cursor: clickable ? "pointer" : "default" }}
									onClick={() => openOrToggle(item.block.id, detailId)}
								>
									{item.block.shape === "cylinder" ? (
										<>
											<rect
												x={item.x}
												y={item.y + 8}
												width={item.width}
												height={Math.max(12, item.height - 16)}
												fill={presentPaint(item.block.fill) || "#b0bec5"}
												stroke={stroke}
												strokeDasharray={dash}
											/>
											<ellipse
												cx={item.x + item.width / 2}
												cy={item.y + 8}
												rx={item.width / 2}
												ry={8}
												fill={presentPaint(item.block.fill) || "#b0bec5"}
												stroke={stroke}
												strokeDasharray={dash}
											/>
											<ellipse
												cx={item.x + item.width / 2}
												cy={item.y + item.height - 8}
												rx={item.width / 2}
												ry={8}
												fill={presentPaint(item.block.fill) || "#b0bec5"}
												stroke={stroke}
												strokeDasharray={dash}
											/>
										</>
									) : item.block.shape === "c" ? (
										<path
											d={cPath(item, nodes)}
											fill={presentPaint(item.block.fill) || "#d6e6fa"}
											stroke={stroke}
											strokeWidth={missingId === item.block.id ? 2 : 1}
											fillRule="evenodd"
										/>
									) : (
										<rect
											x={item.x}
											y={item.y}
											width={item.width}
											height={item.height}
											rx={4}
											fill={presentPaint(item.block.fill) || "#90caf9"}
											stroke={stroke}
											strokeDasharray={dash}
											strokeWidth={missingId === item.block.id ? 2 : 1}
										/>
									)}
									{label && item.block.shape !== "cylinder" && (
										<>
											<rect
												x={item.x}
												y={item.y}
												width={item.width}
												height={18}
												rx={4}
												fill="rgba(80,80,80,0.16)"
											/>
											<text
												x={item.x + item.width / 2}
												y={item.y + 13}
												textAnchor="middle"
												fontSize={11}
												fontWeight={600}
												fill={presentPaint(item.block.labelColor) || "#111"}
											>
												{label}
											</text>
										</>
									)}
									{caption && (
										<text
											x={item.x + item.width / 2}
											y={item.y + (label && item.block.shape !== "cylinder" ? 32 : 16)}
											textAnchor="middle"
											fontSize={10}
											fill={
												presentPaint(item.block.textColor) ||
												presentPaint(item.block.labelColor) ||
												"#37474f"
											}
										>
											{caption}
										</text>
									)}
									{preview.length > 0 && item.block.shape !== "c" && preview.map((member, index) => {
										if (!linked) {
											return (
												<text
													key={member.id}
													x={item.x + 8}
													y={item.y + 32 + (caption ? 16 : 0) + index * 14}
													fontSize={10}
													fill={presentPaint(item.block.labelColor) || "#222"}
												>
													{member.label}
												</text>
											);
										}
										const frameX = item.x + 6;
										const frameY = item.y + 22 + (caption ? 16 : 0) + index * 18;
										const frameWidth = Math.min(
											Math.max(24, item.width - 12),
											Math.max(28, member.label.length * 5.8 + 8)
										);
										const viewId = rootStore.ui.activeView?.id ?? "";
										const href = `/${authStore.getDomain()}/am/${viewId}/element/${member.id}`;
										return (
											<a
												key={member.id}
												href={href}
												style={{ cursor: "pointer" }}
												onClick={(event) => openComponent(event, member.id)}
											>
												<rect
													x={frameX}
													y={frameY}
													width={frameWidth}
													height={15}
													rx={2}
													fill="#ffffff"
													stroke={presentPaint(item.block.stroke) || "#546e7a"}
													strokeWidth={1}
												/>
												<text
													x={frameX + 4}
													y={frameY + 11}
													fontSize={10}
													fill="#1565c0"
												>
													{member.label}
												</text>
											</a>
										);
									})}
									{tagLine && (
										<text x={item.x + 8} y={item.y + 32} fontSize={10} fill="#455a64">
											{tagLine}
										</text>
									)}
								</g>
							);
						})}
						{frames
							.filter((item) => !frames.some((other) => frameDirectlyBelow(other, frames)?.block.id === item.block.id))
							.map((item) => {
							const header = frameHeading(item.block);
							if (!header) {
								return null;
							}
							return (
								<g key={`${item.block.id}-header`}>
									<rect
										x={item.x}
										y={item.y}
										width={item.width}
										height={18}
										rx={4}
										fill={presentPaint(item.block.textFill) || "rgba(80,80,80,0.16)"}
									/>
									<text
										x={item.x + item.width / 2}
										y={item.y + 13}
										textAnchor="middle"
										fontSize={10}
										fill={presentPaint(item.block.labelColor) || "#333"}
									>
										{header}
									</text>
								</g>
							);
						})}
						{layout.lineLabels.map((label) => (
							<g key={label.key}>
								<line
									x1={label.x1}
									y1={label.y1}
									x2={label.x2}
									y2={label.y2}
									stroke={label.color}
									strokeWidth={1.4}
									markerEnd={`url(#${markerIdFor(label.color)})`}
								/>
								<text x={label.x1 + 6} y={label.y1 + 11} fontSize={10} fill={label.color}>
									{label.label}
								</text>
							</g>
						))}
						{regions.map((item) => {
							const title = regionHeadingText(item.block);
							if (!title) {
								return null;
							}
							const align = item.block.align === "start" || item.block.align === "end" ? item.block.align : "center";
							const x = align === "start" ? item.x + 14 : align === "end" ? item.x + item.width - 14 : item.x + item.width / 2;
							return (
								<text
									key={`${item.block.id}-title`}
									x={x}
									y={item.y + 16}
									textAnchor={align === "start" ? "start" : align === "end" ? "end" : "middle"}
									fontSize={13}
									fontWeight={700}
									fill="#0d47a1"
								>
									{title}
								</text>
							);
						})}
						{!regions.some((item) => regionHeadingText(item.block).includes("Backbone")) &&
							nodes
								.filter(
									(item) =>
										item.block.id === "core-services" || graphText(item.block.label).trim() === "Core Services API"
								)
								.slice(0, 1)
								.map((core) => {
									const host =
										regions.find((item) => item.block.id === "region-integration") ||
										regions.find((item) => item.range.c1 <= core.range.c1 && item.range.c2 >= core.range.c2);
									const x = host ? host.x + host.width / 2 : core.x + core.width / 2;
									return (
										<text
											key="region-backbone-title"
											x={x}
											y={Math.max(12, core.y - 6)}
											textAnchor="middle"
											fontSize={13}
											fontWeight={700}
											fill="#0d47a1"
										>
											Core Services "Backbone"
										</text>
									);
								})}
						{layout.bands.map((band) => (
							<g key={`${band.label}:${band.x}:${band.y}`}>
								<rect
									x={band.x}
									y={band.y}
									width={band.width}
									height={band.height}
									rx={4}
									fill={band.fill || "#ffffff"}
									stroke={band.stroke || "#607d8b"}
									strokeDasharray={band.strokeDasharray}
								/>
								<text
									x={band.x + band.width / 2}
									y={band.y + band.height / 2}
									fill={band.labelColor || "#263238"}
									fontSize={11}
									fontWeight={700}
									textAnchor="middle"
									transform={`rotate(-90 ${band.x + band.width / 2} ${band.y + band.height / 2})`}
								>
									{band.label}
								</text>
							</g>
						))}
					</g>
				</svg>
			</div>
		</div>
	);
});
