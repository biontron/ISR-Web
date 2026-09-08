export const OVERVIEW_DEVICES_PER_ROW = 10;
export const OVERVIEW_DEVICE_GAP_X = 12;
export const OVERVIEW_DEVICE_GAP_Y = 12;
export const OVERVIEW_GROUP_GAP = 24;
export const OVERVIEW_CLUSTER_PAD = 16;
export const OVERVIEW_MARGIN = 0;

export type OverviewSizedItem = {
	id: string;
	width: number;
	height: number;
};

export type OverviewTopLeft = {
	left: number;
	top: number;
};

export type OverviewPackedLayout = {
	positions: Map<string, OverviewTopLeft>;
	width: number;
	height: number;
};

/** Zeilenweise von links oben nach rechts unten, letzte Zeile linksbündig. */
export function packItemsLeftToRightRows(
	items: OverviewSizedItem[],
	columns: number,
	gapX: number,
	gapY: number,
	originX: number,
	originY: number
): OverviewPackedLayout {
	const positions = new Map<string, OverviewTopLeft>();
	if (items.length === 0) {
		return { positions, width: 0, height: 0 };
	}

	const cols = Math.max(1, columns);
	let maxRight = originX;
	let bottom = originY;
	let rowTop = originY;

	for (let rowStart = 0; rowStart < items.length; rowStart += cols) {
		const row = items.slice(rowStart, rowStart + cols);
		const rowHeight = Math.max(...row.map((item) => item.height));
		let cursorX = originX;
		for (const item of row) {
			positions.set(item.id, { left: cursorX, top: rowTop });
			cursorX += item.width + gapX;
			maxRight = Math.max(maxRight, cursorX - gapX);
		}
		rowTop += rowHeight + gapY;
		bottom = rowTop - gapY;
	}

	return {
		positions,
		width: Math.max(0, maxRight - originX),
		height: Math.max(0, bottom - originY),
	};
}

/** Kästen untereinander, gemeinsame linke Kante. */
export function stackItemsTopLeft(
	items: OverviewSizedItem[],
	gap: number,
	originX: number,
	originY: number
): OverviewPackedLayout {
	const positions = new Map<string, OverviewTopLeft>();
	let cursorY = originY;
	let maxWidth = 0;

	for (const item of items) {
		positions.set(item.id, { left: originX, top: cursorY });
		cursorY += item.height + gap;
		maxWidth = Math.max(maxWidth, item.width);
	}

	const height = items.length === 0 ? 0 : cursorY - gap - originY;
	return { positions, width: maxWidth, height: Math.max(0, height) };
}
