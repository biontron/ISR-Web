import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { rootStore } from "../../../Stores/Root.Store";
import type { GraphArchitectureRepresentation, GraphCellBlock } from "../../../lib/graphConfig";
import { graphText, presentId, presentPaint } from "../../../lib/graphConfig";
import { readElementGraphTags } from "../../../lib/graphElementStyle";
import { collectConnectionGraphEdges } from "../../../lib/graphConnectionEdges";
import {
	assignMembersToBlocks,
	layoutArchitecture,
	visibleArchitectureEdges,
	type ArchitectureMember,
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
	return (block.previewMembers ?? []).map((member) => ({
		id: member.id,
		label: graphText(member.label) || member.id,
		tags: [],
	}));
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
	const assets = rootStore.assets.assets;
	const connections = rootStore.connections.connections;

	const members = useMemo<ArchitectureMember[]>(() => {
		return assets
			.filter((asset) => asset.class === "Asset" || asset.class === "AssetDetails")
			.map((asset) => ({
				id: asset.id,
				label: asset.definition?.label || asset.definition?.name || asset.id,
				tags: readElementGraphTags(asset),
			}));
	}, [assets]);

	const assignment = useMemo(
		() => assignMembersToBlocks(architecture.blocks, members),
		[architecture.blocks, members]
	);

	const memberCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const block of architecture.blocks) {
			counts.set(block.id, membersOf(assignment.byBlock.get(block.id), block).length);
		}
		return counts;
	}, [architecture.blocks, assignment.byBlock]);

	const layout = useMemo(
		() => layoutArchitecture(architecture, { expandedIds, memberCounts }),
		[architecture, expandedIds, memberCounts]
	);

	const memberToBlock = useMemo(() => {
		const map = new Map<string, string>();
		assignment.byBlock.forEach((blockMembers, blockId) => {
			blockMembers.forEach((member) => {
				map.set(member.id, blockId);
			});
		});
		return map;
	}, [assignment.byBlock]);

	const connectionPairs = useMemo(() => {
		const visible = new Set<string>();
		memberToBlock.forEach((_blockId, memberId) => {
			visible.add(memberId);
		});
		if (visible.size === 0) {
			return [];
		}
		return collectConnectionGraphEdges(Array.from(assets), Array.from(connections), visible).map(
			(edge) => ({ fromId: edge.fromNodeId, toId: edge.toNodeId })
		);
	}, [assets, connections, memberToBlock]);

	const membersByBlock = useMemo(() => {
		const map = new Map<string, string[]>();
		for (const block of architecture.blocks) {
			map.set(
				block.id,
				membersOf(assignment.byBlock.get(block.id), block).map((member) => member.id)
			);
		}
		return map;
	}, [architecture.blocks, assignment.byBlock]);

	const edges = useMemo(
		() =>
			visibleArchitectureEdges(
				layout.placed,
				architecture.edges,
				connectionPairs,
				memberToBlock,
				expandedIds,
				membersByBlock
			),
		[layout.placed, architecture.edges, connectionPairs, memberToBlock, expandedIds, membersByBlock]
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
						{arrowMarkers(edges).map((marker) => (
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
						{regions.map((item) => (
							<rect
								key={item.block.id}
								x={item.x}
								y={item.y}
								width={item.width}
								height={item.height}
								rx={6}
								fill={presentPaint(item.block.fill) || "#f5f5f5"}
								stroke={presentPaint(item.block.stroke) || "#ccc"}
								strokeDasharray={blockDash(item.block)}
							/>
						))}
						{frames.map((item) => (
							<rect
								key={item.block.id}
								x={item.x}
								y={item.y}
								width={item.width}
								height={item.height}
								rx={4}
								fill={presentPaint(item.block.fill) || "transparent"}
								stroke={presentPaint(item.block.stroke) || "#4466aa"}
								strokeDasharray={blockDash(item.block)}
							/>
						))}
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
							const shown = membersOf(assignment.byBlock.get(item.block.id), item.block);
							const label = graphText(item.block.label).trim();
							const caption = graphText(item.block.text).trim();
							const previewCount = expanded && !detailId ? 6 : 3;
							const preview = shown.slice(0, previewCount);
							const tagLine =
								preview.length === 0 ? (item.block.tags ?? []).filter(Boolean).join(", ") : "";
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
									{label && (
										<text
											x={item.x + item.width / 2}
											y={item.y + 16}
											textAnchor="middle"
											fontSize={11}
											fontWeight={600}
											fill={presentPaint(item.block.labelColor) || "#111"}
										>
											{label}
										</text>
									)}
									{caption && (
										<g>
											<rect
												x={item.x + 6}
												y={item.y + (label ? 22 : 8)}
												width={Math.max(24, item.width - 12)}
												height={16}
												rx={3}
												fill={presentPaint(item.block.textFill) || "#ffffff"}
												stroke={presentPaint(item.block.textStroke) || "#90a4ae"}
												strokeDasharray={presentPaint(item.block.textStrokeDasharray)}
											/>
											<text
												x={item.x + item.width / 2}
												y={item.y + (label ? 34 : 20)}
												textAnchor="middle"
												fontSize={10}
												fill={presentPaint(item.block.textColor) || "#222"}
											>
												{caption}
											</text>
										</g>
									)}
									{preview.map((member, index) => (
										<text
											key={member.id}
											x={item.x + 8}
											y={item.y + 32 + (caption ? 16 : 0) + index * 14}
											fontSize={10}
											fill="#222"
										>
											{member.label}
										</text>
									))}
									{tagLine && (
										<text x={item.x + 8} y={item.y + 32} fontSize={10} fill="#455a64">
											{tagLine}
										</text>
									)}
								</g>
							);
						})}
						{frames.map((item) => {
							const header = graphText(item.block.header).trim();
							if (!header) {
								return null;
							}
							const chipWidth = Math.min(item.width - 8, Math.max(36, header.length * 6 + 12));
							return (
								<g key={`${item.block.id}-header`}>
									<rect
										x={item.x + 4}
										y={item.y + 3}
										width={chipWidth}
										height={16}
										rx={3}
										fill={presentPaint(item.block.textFill) || "#ffffff"}
										stroke={presentPaint(item.block.textStroke) || presentPaint(item.block.stroke) || "#4466aa"}
										strokeDasharray={presentPaint(item.block.textStrokeDasharray) || blockDash(item.block)}
									/>
									<text x={item.x + 8} y={item.y + 15} fontSize={10} fill={presentPaint(item.block.labelColor) || "#333"}>
										{header}
									</text>
								</g>
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
