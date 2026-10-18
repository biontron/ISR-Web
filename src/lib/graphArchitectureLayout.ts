import type {
	GraphArchitectureEdge,
	GraphArchitectureRepresentation,
	GraphCellBlock,
	GraphCellRole,
	GraphRowBand,
} from "./graphConfig";
import { graphText, normalizeHashtagForMatch, presentPaint, readTagStrings } from "./graphConfig";

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

export type PlacedLineLabel = {
	key: string;
	label: string;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	color: string;
};

export type ArchitectureLayout = {
	width: number;
	height: number;
	placed: PlacedBlock[];
	bands: PlacedBand[];
	lineLabels: PlacedLineLabel[];
	errors: string[];
};

const GAP = 16;
const PAD = 10;
const GUTTER = 46;
const MIN_COL = 86;
const MIN_ROW = 48;
const BAND_WIDTH = 22;
const BAND_GAP = 8;
const COMPANION_WIDTH = 58;
const TITLE_BAND = 22;

export function regionHeadingText(block: GraphCellBlock): string {
	const header = graphText(block.header).trim();
	if (header) {
		return header;
	}
	const label = graphText(block.label).trim();
	if (block.role === "region" && label) {
		return label;
	}
	if (block.id === "region-experience") {
		return "Externe Systeme / Portale / AI-Agenten";
	}
	if (block.id === "region-integration") {
		return "Externe Schnittstellen";
	}
	if (block.id === "region-backbone") {
		return 'Core Services "Backbone"';
	}
	if (block.id === "region-business") {
		return "Interne Anwendungen";
	}
	if (block.id === "region-legacy") {
		return "Altsysteme (Legacy)";
	}
	return "";
}

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

/** Öffnung eines C: Mittelzeilen, rechts von der linken Spalte. Dort darf ein Block hineinragen. */
export function sitsInCOpening(host: { block: GraphCellBlock; range: CellRange }, guest: CellRange): boolean {
	if (host.block.shape !== "c" || host.range.r2 - host.range.r1 < 2) {
		return false;
	}
	const openTop = host.range.r1 + 1;
	const openBottom = host.range.r2 - 1;
	if (guest.r1 < openTop || guest.r2 > openBottom) {
		return false;
	}
	return guest.c1 > host.range.c1 && guest.c1 <= host.range.c2;
}

function blockRole(block: GraphCellBlock): GraphCellRole {
	return block.role ?? "node";
}

function tagKey(tag: unknown): string {
	if (typeof tag === "string") {
		return normalizeHashtagForMatch(tag);
	}
	if (tag && typeof tag === "object" && "tag" in tag) {
		return tagKey((tag as { tag: unknown }).tag);
	}
	return "";
}

function blockMatchesMember(block: GraphCellBlock, member: ArchitectureMember): boolean {
	const tags = readTagStrings(block.tags).map(tagKey).filter(Boolean);
	if (tags.length === 0) {
		return false;
	}
	const memberTags = member.tags.map(tagKey);
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
			for (const block of tagged) {
				byBlock.get(block.id)?.push(member);
			}
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
		height += Math.min(memberCount, expanded ? 6 : 3) * 18 + 8;
	}
	if (graphText(block.text)) {
		height += 18;
	}
	if (block.align === "center") {
		return { width: Math.min(width, 220), height: Math.min(height, graphText(block.text) ? 64 : 48) };
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

function shadeHex(hex: string, factor: number): string | undefined {
	const raw = hex.trim().replace("#", "");
	if (!/^[0-9a-fA-F]{6}$/.test(raw)) {
		return undefined;
	}
	const channels = [0, 2, 4].map((offset) =>
		Math.max(0, Math.min(255, Math.round(parseInt(raw.slice(offset, offset + 2), 16) * factor)))
	);
	return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function pairRowCompanions(
	parsed: { block: GraphCellBlock; range: CellRange }[]
): { frameIndex: number; companionIndex: number; row: number }[] {
	const rows: number[] = [];
	for (const item of parsed) {
		if (item.range.r1 === item.range.r2 && rows.indexOf(item.range.r1) < 0) {
			rows.push(item.range.r1);
		}
	}
	const pairs: { frameIndex: number; companionIndex: number; row: number }[] = [];
	for (const row of rows) {
		const frames = parsed
			.map((item, index) => ({ item, index }))
			.filter(
				({ item }) => item.block.role === "frame" && item.range.r1 <= row && item.range.r2 >= row
			)
			.sort((left, right) => left.item.range.c1 - right.item.range.c1);
		if (frames.length === 0) {
			continue;
		}
		let maxFrameCol = 0;
		for (const frame of frames) {
			maxFrameCol = Math.max(maxFrameCol, frame.item.range.c2);
		}
		const companions = parsed
			.map((item, index) => ({ item, index }))
			.filter(({ item }) => {
				if (blockRole(item.block) !== "node") {
					return false;
				}
				if (item.range.r1 !== row || item.range.r2 !== row || item.range.c1 !== item.range.c2) {
					return false;
				}
				if (item.range.c1 <= maxFrameCol) {
					return false;
				}
				return !frames.some((frame) => rangeCovers(frame.item.range, item.range));
			})
			.sort((left, right) => left.item.range.c1 - right.item.range.c1);
		if (companions.length !== frames.length) {
			continue;
		}
		for (let index = 0; index < frames.length; index += 1) {
			pairs.push({
				frameIndex: frames[index].index,
				companionIndex: companions[index].index,
				row,
			});
		}
	}
	return pairs;
}

function attachCompanions(
	placed: PlacedBlock[],
	pairs: { frameIndex: number; companionIndex: number; row: number }[]
) {
	for (const pair of pairs) {
		const frame = placed[pair.frameIndex];
		const companion = placed[pair.companionIndex];
		const siblings = placed
			.filter(
				(item) =>
					item !== companion &&
					blockRole(item.block) === "node" &&
					item.range.r1 === pair.row &&
					rangeCovers(frame.range, item.range)
			)
			.sort((left, right) => left.x - right.x);
		const sibling = siblings[siblings.length - 1];
		const width = Math.min(COMPANION_WIDTH, Math.max(48, frame.width * 0.34));
		companion.width = width;
		companion.height = sibling ? sibling.height : Math.min(companion.height, 36);
		companion.y = sibling ? sibling.y : frame.y + PAD;
		companion.x = frame.x + frame.width - 4 - width;
		for (const siblingNode of siblings) {
			const limit = companion.x - 6;
			if (siblingNode.x + siblingNode.width > limit) {
				siblingNode.width = Math.max(36, limit - siblingNode.x);
			}
		}
	}
}

function placeUserGroupLines(placed: PlacedBlock[]): PlacedLineLabel[] {
	const labels: PlacedLineLabel[] = [];
	const nodes = placed.filter((item) => blockRole(item.block) === "node");
	for (const frame of placed) {
		if (frame.block.role !== "frame") {
			continue;
		}
		const header = graphText(frame.block.header).trim();
		if (!header.includes("·")) {
			continue;
		}
		const parts = header
			.split("·")
			.map((part) => part.trim())
			.filter(Boolean);
		const topNodes = nodes
			.filter((item) => item.range.r1 === frame.range.r1 && rangeCovers(frame.range, item.range))
			.sort((left, right) => left.range.c1 - right.range.c1 || left.x - right.x);
		if (parts.length === 0 || topNodes.length === 0) {
			continue;
		}
		const color = presentPaint(frame.block.stroke) || "#4466aa";
		for (let index = 0; index < parts.length; index += 1) {
			const node =
				parts.length === topNodes.length
					? topNodes[index]
					: topNodes[Math.min(topNodes.length - 1, Math.floor((index * topNodes.length) / parts.length))];
			const x =
				parts.length === topNodes.length
					? node.x + node.width / 2
					: frame.x + ((index + 1) / (parts.length + 1)) * frame.width;
			labels.push({
				key: `${frame.block.id}:${index}`,
				label: parts[index],
				x1: x,
				y1: frame.y + 22,
				x2: x,
				y2: Math.max(frame.y + 32, node.y - 2),
				color,
			});
		}
	}
	return labels;
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
			if (sitsInCOpening(a, b.range) || sitsInCOpening(b, a.range)) {
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

	const companionPairs = pairRowCompanions(parsed);
	const widenedColumns = new Set<number>();
	for (const pair of companionPairs) {
		const column = parsed[pair.frameIndex].range.c2;
		if (widenedColumns.has(column)) {
			continue;
		}
		widenedColumns.add(column);
		colW[column] += COMPANION_WIDTH + 8;
	}
	const lineLabelRows = new Set<number>();
	for (const item of parsed) {
		if (item.block.role === "frame" && graphText(item.block.header).includes("·")) {
			lineLabelRows.add(item.range.r1);
		}
	}
	lineLabelRows.forEach((row) => {
		rowH[row] += 28;
	});

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
		if (!headerFrame || item.range.r1 !== headerFrame.range.r1) {
			continue;
		}
		const gutter = graphText(headerFrame.block.header).includes("·") ? 40 : 22;
		item.y += gutter;
		item.height = Math.max(28, item.height - gutter);
	}

	for (const region of placed) {
		if (region.block.role !== "region" || !regionHeadingText(region.block)) {
			continue;
		}
		for (const item of placed) {
			if (item.block.role === "region" || item.range.r1 !== region.range.r1) {
				continue;
			}
			if (
				item.range.c1 < region.range.c1 ||
				item.range.c2 > region.range.c2 ||
				item.range.r2 > region.range.r2
			) {
				continue;
			}
			item.y += TITLE_BAND;
			item.height = Math.max(24, item.height - TITLE_BAND);
		}
	}
	const backboneNamed = placed.some(
		(item) => item.block.role === "region" && regionHeadingText(item.block).includes("Backbone")
	);
	if (!backboneNamed) {
		const core = placed.find(
			(item) => item.block.id === "core-services" || graphText(item.block.label).trim() === "Core Services API"
		);
		if (core) {
			for (const item of placed) {
				if (item.block.role === "region" || item.range.r1 !== core.range.r1) {
					continue;
				}
				item.y += TITLE_BAND;
				item.height = Math.max(24, item.height - TITLE_BAND);
			}
		}
	}

	attachCompanions(placed, companionPairs);
	const lineLabels = placeUserGroupLines(placed);

	const bands: PlacedBand[] = [];
	for (const band of architecture.rowBands ?? []) {
		const placedBand = placeRowBand(band, colX, rowY, rowH, rowCount, colCount);
		if (!placedBand) {
			continue;
		}
		const bandRange = parseRange(band.range);
		const region = parsed.find(
			(item) => item.block.role === "region" && bandRange && rangeCovers(item.range, bandRange)
		);
		const regionFill = presentPaint(region?.block.fill);
		if (!placedBand.fill && regionFill) {
			placedBand.fill = regionFill;
		}
		if (!placedBand.stroke && regionFill) {
			placedBand.stroke = shadeHex(regionFill, 0.62);
		}
		bands.push(placedBand);
	}

	const width = cursorX - GAP + 24;
	const height = originY + rowH.reduce((sum, size) => sum + size, 0) + GAP * Math.max(0, rowCount - 1) + 24;
	return { width, height, placed, bands, lineLabels, errors };
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

function approach(host: PlacedBlock, towardX: number, towardY: number): { x: number; y: number } {
	const center = centerOf(host);
	const dx = towardX - center.x;
	const dy = towardY - center.y;
	if (Math.abs(dx) * host.height > Math.abs(dy) * host.width) {
		return { x: dx >= 0 ? host.x + host.width : host.x, y: center.y };
	}
	return { x: center.x, y: dy >= 0 ? host.y + host.height : host.y };
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
	const pointOf = (
		id: string
	): { x: number; y: number; blockId: string; host?: PlacedBlock } | undefined => {
		const direct = byId.get(id);
		if (direct) {
			const center = centerOf(direct);
			return { ...center, blockId: direct.block.id, host: direct };
		}
		const blockId = memberToBlock.get(id);
		const host = blockId ? byId.get(blockId) : undefined;
		if (!host || !blockId) {
			return undefined;
		}
		if (!expandedIds.has(blockId)) {
			const center = centerOf(host);
			return { ...center, blockId, host };
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
		const fromPoint = from.host ? approach(from.host, to.x, to.y) : from;
		const toPoint = to.host ? approach(to.host, from.x, from.y) : to;
		const key = `${from.blockId}->${to.blockId}:${edge.bidirectional ? "2" : "1"}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		edges.push({
			key,
			fromX: fromPoint.x,
			fromY: fromPoint.y,
			toX: toPoint.x,
			toY: toPoint.y,
			bidirectional: edge.bidirectional,
			lineColor: edge.lineColor,
			arrowColor: edge.arrowColor,
		});
	}
	return edges;
}
