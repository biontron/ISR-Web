export type ConnectionDirection = "DUAL" | "IN" | "OUT" | "LOGICAL";

export const CONNECTION_DIRECTIONS: ConnectionDirection[] = [
	"DUAL",
	"IN",
	"OUT",
	"LOGICAL",
];

export type ConnectionDirectionMarkers = {
	markerStart?: string;
	markerEnd?: string;
	strokeDasharray?: string;
};

const LEGACY_DIRECTION_MAP: Record<string, ConnectionDirection | undefined> = {
	FROM_TO: "OUT",
	TO_FROM: "IN",
};

export function normalizeConnectionDirection(
	value: string | null | undefined
): ConnectionDirection | null {
	const trimmed = value?.trim();
	if (!trimmed) {
		return null;
	}
	if (CONNECTION_DIRECTIONS.includes(trimmed as ConnectionDirection)) {
		return trimmed as ConnectionDirection;
	}
	return LEGACY_DIRECTION_MAP[trimmed] ?? null;
}

export function isKnownConnectionDirection(value: string | null | undefined): boolean {
	const trimmed = value?.trim();
	if (!trimmed) {
		return false;
	}
	return (
		CONNECTION_DIRECTIONS.includes(trimmed as ConnectionDirection) ||
		trimmed in LEGACY_DIRECTION_MAP
	);
}

export function resolveConnectionDirection(
	value: string | null | undefined,
	fallback: ConnectionDirection = "DUAL"
): ConnectionDirection {
	return normalizeConnectionDirection(value) ?? fallback;
}

export function connectionDirectionLabel(direction: ConnectionDirection): string {
	switch (direction) {
		case "DUAL":
			return "↔ Dual";
		case "OUT":
			return "→ Out";
		case "IN":
			return "← In";
		case "LOGICAL":
			return "— Logical";
		default:
			return direction;
	}
}

export function connectionDirectionSelectOptions(): Array<{
	value: ConnectionDirection;
	label: string;
}> {
	return CONNECTION_DIRECTIONS.map((value) => ({
		value,
		label: connectionDirectionLabel(value),
	}));
}

export function resolveConnectionDirectionMarkers(
	direction: ConnectionDirection,
	arrowStartId: string,
	arrowEndId: string
): ConnectionDirectionMarkers {
	switch (direction) {
		case "OUT":
			return { markerEnd: `url(#${arrowEndId})` };
		case "IN":
			return { markerStart: `url(#${arrowStartId})` };
		case "DUAL":
			return {
				markerStart: `url(#${arrowStartId})`,
				markerEnd: `url(#${arrowEndId})`,
			};
		case "LOGICAL":
			return { strokeDasharray: "6 4" };
		default:
			return {};
	}
}

export function connectionUriSidesForDirection(
	direction: ConnectionDirection
): { from: boolean; to: boolean } {
	switch (direction) {
		case "OUT":
			return { from: true, to: false };
		case "IN":
			return { from: false, to: true };
		case "DUAL":
			return { from: true, to: true };
		case "LOGICAL":
			return { from: false, to: false };
		default:
			return { from: true, to: true };
	}
}
