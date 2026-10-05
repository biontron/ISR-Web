import type {
	GraphArchitectureEdge,
	GraphArchitectureRepresentation,
	GraphCellBlock,
	GraphCellRole,
	GraphRowBand,
} from "./graphConfig";
import { graphText, presentPaint } from "./graphConfig";

export type CellRange = {
	c1: number;
	r1: number;
	c2: number;
	r2: number;
};

export type ArchitectureMember = {
	id: string;
	label: string;
	tags: string[];
};

export type PlacedBlock = {
	block: GraphCellBlock;
	range: CellRange;
	x: number;
	y: number;
	width: number;
	height: number;
};

export type PlacedBand = {
	label: string;
	x: number;
	y: number;
	width: number;
	height: number;
	fill?: string;
	stroke?: string;
	strokeDasharray?: string;
	labelColor?: string;
};

export type ArchitectureLayout = {
	width: number;
	height: number;
	placed: PlacedBlock[];
	bands: PlacedBand[];
	errors: string[];
};

const GAP = 16;
const PAD = 10;
const GUTTER = 46;
const MIN_COL = 86;
const MIN_ROW = 48;
const BAND_WIDTH = 22;
const BAND_GAP = 8;

export function columnIndex(letters: string): number | null {
	const value = letters.trim().toUpperCase();
	if (!/^[A-Z]+$/.test(value)) {
		return null;
	}
	let index = 0;
	for (let i = 0; i < value.length; i += 1) {
		index = index * 26 + (value.charCodeAt(i) - 64);
	}
	return index - 1;
}

export function parseRange(range: string): CellRange | null {
	const match = range
		.trim()
		.toUpperCase()
		.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
	if (!match) {
		return null;
	}
	const c1 = columnIndex(match[1]);
	const c2 = match[3] ? columnIndex(match[3]) : c1;
	const r1 = Number(match[2]) - 1;
	const r2 = match[4] ? Number(match[4]) - 1 : r1;
	if (c1 == null || c2 == null || r1 < 0 || r2 < 0) {
		return null;
	}
	return {
		c1: Math.min(c1, c2),
		r1: Math.min(r1, r2),
		c2: Math.max(c1, c2),
		r2: Math.max(r1, r2),
	};
}

export function rangeCovers(outer: CellRange, inner: CellRange): boolean {
	return outer.c1 <= inner.c1 && outer.c2 >= inner.c2 && outer.r1 <= inner.r1 && outer.r2 >= inner.r2;
}

export function rangesOverlap(a: CellRange, b: CellRange): boolean {
	return a.c1 <= b.c2 && b.c1 <= a.c2 && a.r1 <= b.r2 && b.r1 <= a.r2;
}

function blockRole(block: GraphCellBlock): GraphCellRole {
	return block.role ?? "node";
}

function normalizeTag(tag: string): string {
	return tag.trim().toLowerCase().replace(/^#+/, "");
}

function blockMatchesMember(block: GraphCellBlock, member: ArchitectureMember): boolean {
	const tags = (block.tags ?? []).map(normalizeTag).filter(Boolean);
	if (tags.length === 0) {
		return false;
	}
	const memberTags = member.tags.map(normalizeTag);
	return memberTags.some((tag) => tags.includes(tag));
}

export function assignMembersToBlocks(
	blocks: GraphCellBlock[],
	members: ArchitectureMember[]
): { byBlock: Map<string, ArchitectureMember[]>; errors: string[] } {
	const errors: string[] = [];
	const byBlock = new Map<string, ArchitectureMember[]>();
	const contentBlocks = blocks.filter((block) => blockRole(block) === "node");
	for (const block of contentBlocks) {
		byBlock.set(block.id, []);
	}

	const directOwner = new Map<string, string>();
	for (const block of contentBlocks) {
		for (const elementId of block.elementIds ?? []) {
			const previous = directOwner.get(elementId);
			if (previous && previous !== block.id) {
				errors.push(`${elementId} ist direkt mit ${previous} und ${block.id} verknüpft`);
				continue;
			}
			directOwner.set(elementId, block.id);
		}
	}

	for (const member of members) {
		const direct = directOwner.get(member.id);
		if (direct) {
			byBlock.get(direct)?.push(member);
			continue;
		}
		const tagged = contentBlocks.filter(
			(block) => !block.fallback && blockMatchesMember(block, member)
		);
		if (tagged.length > 0) {
			byBlock.get(tagged[0].id)?.push(member);
			continue;
		}
		const fallback = contentBlocks.find((block) => block.fallback);
		if (fallback) {
			byBlock.get(fallback.id)?.push(member);
		}
	}

	return { byBlock, errors };
}

function preferredSize(
	block: GraphCellBlock,
	expanded: boolean,
	memberCount: number
): { width: number; height: number } {
	if (blockRole(block) !== "node") {
		return { width: 0, height: 0 };
	}
	const label = graphText(block.label) || block.id;
	const width = Math.max(MIN_COL, Math.min(260, label.length * 7 + 36));
	let height = block.shape === "cylinder" ? 58 : 36;
	if (memberCount > 0) {
		height += Math.min(memberCount, expanded ? 6 : 3) * 14 + 8;
	}
	if (graphText(block.text)) {
		height += 18;
	}
	if (block.align === "center") {
		return { width: Math.min(width, 168), height: Math.min(height, 48) };
	}
	return { width, height };
}

function distribute(sizes: number[], start: number, end: number, needed: number) {
	const span = end - start + 1;
	const current = sizes.slice(start, end + 1).reduce((sum, size) => sum + size, 0);
	const gaps = GAP * Math.max(0, span - 1);
	const extra = needed - (current + gaps);
	if (extra <= 0 || span <= 0) {
		return;
	}
	const share = extra / span;
	for (let index = start; index <= end; index += 1) {
		sizes[index] += share;
	}
}

export function layoutArchitecture(
	architecture: GraphArchitectureRepresentation,
	options?: { expandedIds?: ReadonlySet<string>; memberCounts?: ReadonlyMap<string, number> }
): ArchitectureLayout {
	const errors: string[] = [];
	const parsed: { block: GraphCellBlock; range: CellRange }[] = [];
	for (const block of architecture.blocks) {
		const range = parseRange(block.range);
		if (!range) {
			errors.push(`Ungültiges Rechteck ${block.range} an ${block.id}`);
			continue;
		}
		parsed.push({ block, range });
	}

	for (let left = 0; left < parsed.length; left += 1) {
		for (let right = left + 1; right < parsed.length; right += 1) {
			const a = parsed[left];
			const b = parsed[right];
			if (!rangesOverlap(a.range, b.range)) {
				continue;
			}
			if (rangeCovers(a.range, b.range) || rangeCovers(b.range, a.range)) {
				continue;
			}
			errors.push(`${a.block.id} und ${b.block.id} überlappen`);
		}
	}

	const colCount = Math.max(1, ...parsed.map((item) => item.range.c2 + 1), architecture.columns?.length ?? 0);
	const rowCount = Math.max(1, ...parsed.map((item) => item.range.r2 + 1), architecture.rows?.length ?? 0);
	const colW = Array.from({ length: colCount }, () => MIN_COL);
	const rowH = Array.from({ length: rowCount }, () => MIN_ROW);
	const expandedIds = options?.expandedIds ?? new Set<string>();
	const memberCounts = options?.memberCounts ?? new Map<string, number>();

	for (const item of parsed) {
		const preferred = preferredSize(
			item.block,
			expandedIds.has(item.block.id),
			memberCounts.get(item.block.id) ?? item.block.previewMembers?.length ?? 0
		);
		if (item.range.c1 === item.range.c2) {
			colW[item.range.c1] = Math.max(colW[item.range.c1], preferred.width);
		}
		if (item.range.r1 === item.range.r2 && item.block.align !== "center") {
			rowH[item.range.r1] = Math.max(rowH[item.range.r1], preferred.height);
		}
	}
	for (const item of parsed) {
		const preferred = preferredSize(
			item.block,
			expandedIds.has(item.block.id),
			memberCounts.get(item.block.id) ?? item.block.previewMembers?.length ?? 0
		);
		if (item.range.c1 !== item.range.c2) {
			distribute(colW, item.range.c1, item.range.c2, preferred.width);
		}
		if (item.range.r1 !== item.range.r2 && item.block.align !== "center") {
			distribute(rowH, item.range.r1, item.range.r2, preferred.height);
		}
	}

	const originX = GUTTER;
	const originY = 16;
	const bandColumns = new Set<number>();
	for (const band of architecture.rowBands ?? []) {
		const range = parseRange(band.range);
		if (range && range.c1 > 0) {
			bandColumns.add(range.c1);
		}
	}
	const colX: number[] = [];
	const rowY: number[] = [];
	let cursorX = originX;
	for (let col = 0; col < colCount; col += 1) {
		if (bandColumns.has(col)) {
			cursorX += BAND_WIDTH + BAND_GAP + 4;
		}
		colX.push(cursorX);
		cursorX += colW[col] + GAP;
	}
	let cursorY = originY;
	for (let row = 0; row < rowCount; row += 1) {
		rowY.push(cursorY);
		cursorY += rowH[row] + GAP;
	}

	const placed: PlacedBlock[] = parsed.map((item) => {
		const x = colX[item.range.c1];
		const y = rowY[item.range.r1];
		const width =
			colX[item.range.c2] + colW[item.range.c2] - x;
		const fullHeight = rowY[item.range.r2] + rowH[item.range.r2] - y;
		const preferred = preferredSize(
			item.block,
			expandedIds.has(item.block.id),
			memberCounts.get(item.block.id) ?? item.block.previewMembers?.length ?? 0
		);
		if (blockRole(item.block) === "node" && item.block.align === "center" && preferred.height < fullHeight) {
			return {
				block: item.block,
				range: item.range,
				x: x + PAD,
				y: y + (fullHeight - preferred.height) / 2,
				width: Math.max(24, width - PAD * 2),
				height: preferred.height,
			};
		}
		const inset = blockRole(item.block) === "node" ? PAD : 0;
		return {
			block: item.block,
			range: item.range,
			x: x + inset,
			y: y + inset,
			width: Math.max(24, width - inset * 2),
			height: Math.max(24, fullHeight - inset * 2),
		};
	});

	for (const item of placed) {
		if (blockRole(item.block) !== "node") {
			continue;
		}
		const headerFrame = parsed.find(
			(other) =>
				other.block.role === "frame" &&
				graphText(other.block.header).trim() &&
				rangeCovers(other.range, item.range)
		);
		if (!headerFrame) {
			continue;
		}
		item.y += 22;
		item.height = Math.max(28, item.height - 22);
	}

	const bands: PlacedBand[] = [];
	for (const band of architecture.rowBands ?? []) {
		const placedBand = placeRowBand(band, colX, rowY, rowH, rowCount, colCount);
		if (placedBand) {
			bands.push(placedBand);
		}
	}

	const width = cursorX - GAP + 24;
	const height = originY + rowH.reduce((sum, size) => sum + size, 0) + GAP * Math.max(0, rowCount - 1) + 24;
	return { width, height, placed, bands, errors };
}

export type VisibleArchitectureEdge = {
	key: string;
	fromX: number;
	fromY: number;
	toX: number;
	toY: number;
	bidirectional: boolean;
	lineColor?: string;
	arrowColor?: string;
};

function placeRowBand(
	band: GraphRowBand,
	colX: number[],
	rowY: number[],
	rowH: number[],
	rowCount: number,
	colCount: number
): PlacedBand | null {
	const range = parseRange(band.range);
	if (!range || range.r1 >= rowCount || colX.length === 0) {
		return null;
	}
	const y = rowY[Math.min(range.r1, rowCount - 1)];
	const endRow = Math.min(range.r2, rowCount - 1);
	const height = rowY[endRow] + rowH[endRow] - y;
	const column = Math.min(Math.max(range.c1, 0), Math.max(0, colCount - 1));
	const blockLeft = colX[column];
	const shift = typeof band.offset === "number" && Number.isFinite(band.offset) ? band.offset : 0;
	const gap = Math.max(2, BAND_GAP - shift);
	const x = Math.max(2, blockLeft - gap - BAND_WIDTH);
	return {
		label: graphText(band.label),
		x,
		y,
		width: BAND_WIDTH,
		height,
		fill: presentPaint(band.fill),
		stroke: presentPaint(band.stroke),
		strokeDasharray: presentPaint(band.strokeDasharray),
		labelColor: presentPaint(band.labelColor),
	};
}

function centerOf(placed: PlacedBlock): { x: number; y: number } {
	return { x: placed.x + placed.width / 2, y: placed.y + placed.height / 2 };
}

export function visibleArchitectureEdges(
	placed: PlacedBlock[],
	declared: GraphArchitectureEdge[] | undefined,
	connectionPairs: { fromId: string; toId: string }[],
	memberToBlock: Map<string, string>,
	expandedIds: ReadonlySet<string>,
	membersByBlock?: ReadonlyMap<string, string[]>
): VisibleArchitectureEdge[] {
	const byId = new Map(placed.map((item) => [item.block.id, item]));
	const pointOf = (id: string): { x: number; y: number; blockId: string } | undefined => {
		const direct = byId.get(id);
		if (direct) {
			const center = centerOf(direct);
			return { ...center, blockId: direct.block.id };
		}
		const blockId = memberToBlock.get(id);
		const host = blockId ? byId.get(blockId) : undefined;
		if (!host || !blockId) {
			return undefined;
		}
		if (!expandedIds.has(blockId)) {
			const center = centerOf(host);
			return { ...center, blockId };
		}
		const index = (membersByBlock?.get(blockId) ?? []).indexOf(id);
		return {
			x: host.x + 12,
			y: host.y + 32 + Math.max(0, index) * 14,
			blockId,
		};
	};

	const raw: {
		from: string;
		to: string;
		bidirectional: boolean;
		lineColor?: string;
		arrowColor?: string;
	}[] = [];
	for (const edge of declared ?? []) {
		raw.push({
			from: edge.from,
			to: edge.to,
			bidirectional: Boolean(edge.bidirectional),
			lineColor: presentPaint(edge.lineColor),
			arrowColor: presentPaint(edge.arrowColor),
		});
	}
	for (const pair of connectionPairs) {
		const fromBlock = memberToBlock.get(pair.fromId);
		const toBlock = memberToBlock.get(pair.toId);
		const fromVisible = expandedIds.has(fromBlock ?? "") ? pair.fromId : fromBlock;
		const toVisible = expandedIds.has(toBlock ?? "") ? pair.toId : toBlock;
		if (!fromVisible || !toVisible || fromVisible === toVisible) {
			continue;
		}
		raw.push({ from: fromVisible, to: toVisible, bidirectional: false });
	}

	const seen = new Set<string>();
	const edges: VisibleArchitectureEdge[] = [];
	for (const edge of raw) {
		const from = pointOf(edge.from);
		const to = pointOf(edge.to);
		if (!from || !to || from.blockId === to.blockId) {
			continue;
		}
		const key = `${from.blockId}->${to.blockId}:${edge.bidirectional ? "2" : "1"}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		edges.push({
			key,
			fromX: from.x,
			fromY: from.y,
			toX: to.x,
			toY: to.y,
			bidirectional: edge.bidirectional,
			lineColor: edge.lineColor,
			arrowColor: edge.arrowColor,
		});
	}
	return edges;
}
