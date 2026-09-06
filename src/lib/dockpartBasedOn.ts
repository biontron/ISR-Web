export type DockpartStackRef = {
	id: string | number;
	type?: string;
	protocol?: string;
};

export type DockpartSchemaStackInfo = {
	id: string;
	type: string;
	parent?: {
		whitelist?: string[];
	};
};

export type DockpartBasedOnEntry = {
	dockpartId: string;
};

/** Bevorzugte darunterliegende Typen, falls das Schema keine parent.whitelist hat. */
export const DEFAULT_LOWER_LAYER_TYPES: Record<string, string[]> = {
	ETHERNET: ["GENERIC"],
	VLAN: ["ETHERNET", "GENERIC"],
	IP: ["VLAN", "ETHERNET", "GENERIC"],
	TCP: ["IP", "GENERIC"],
	UDP: ["IP", "GENERIC"],
	ICMP: ["IP", "GENERIC"],
	QUICK: ["UDP", "IP", "GENERIC"],
	HTTP: ["TCP", "QUICK", "GENERIC"],
	DNS: ["IP", "GENERIC"],
};

const STACK_RANK: Record<string, number> = {
	GENERIC: 0,
	ETHERNET: 10,
	VLAN: 20,
	IP: 30,
	TCP: 40,
	UDP: 40,
	ICMP: 40,
	QUICK: 50,
	HTTP: 60,
	DNS: 60,
};

export function normalizeDockpartType(value: string | undefined | null): string {
	const trimmed = String(value ?? "").trim();
	if (!trimmed) {
		return "";
	}
	const upper = trimmed.toUpperCase();
	if (upper === "IPV4" || upper === "IPV6") {
		return "IP";
	}
	return upper;
}

export function dockpartStackType(part: DockpartStackRef): string {
	return normalizeDockpartType(part.type || part.protocol || "");
}

export function dockpartStackRank(type: string | undefined | null): number {
	const normalized = normalizeDockpartType(type);
	return STACK_RANK[normalized] ?? 35;
}

export function findDockpartSchema(
	typeOrId: string,
	schemas: DockpartSchemaStackInfo[]
): DockpartSchemaStackInfo | undefined {
	const needle = normalizeDockpartType(typeOrId);
	if (!needle) {
		return undefined;
	}
	return schemas.find(
		(schema) =>
			normalizeDockpartType(schema.type) === needle ||
			normalizeDockpartType(schema.id) === needle
	);
}

export function resolveAllowedLowerTypes(
	type: string,
	schemas: DockpartSchemaStackInfo[] = []
): string[] {
	const schema = findDockpartSchema(type, schemas);
	const whitelist = (schema?.parent?.whitelist ?? [])
		.map((entry) => normalizeDockpartType(entry))
		.filter(Boolean);
	if (whitelist.length > 0) {
		return whitelist;
	}
	return DEFAULT_LOWER_LAYER_TYPES[normalizeDockpartType(type)] ?? [];
}

export function resolveBasedOnFromSiblings(
	type: string,
	siblings: DockpartStackRef[],
	schemas: DockpartSchemaStackInfo[] = [],
	excludeId?: string | number
): DockpartBasedOnEntry[] {
	const selfId = excludeId == null ? "" : String(excludeId);
	const allowed = resolveAllowedLowerTypes(type, schemas);
	for (const allowedType of allowed) {
		const match = siblings.find((sibling) => {
			if (selfId && String(sibling.id) === selfId) {
				return false;
			}
			return dockpartStackType(sibling) === allowedType;
		});
		if (match) {
			return [{ dockpartId: String(match.id) }];
		}
	}
	return [];
}

export function basedOnEntriesAreValid(
	entries: Array<{ dockpartId?: string | number }>,
	siblings: DockpartStackRef[],
	selfId?: string | number
): boolean {
	if (entries.length === 0) {
		return false;
	}
	const self = selfId == null ? "" : String(selfId);
	return entries.every((entry) => {
		const id = String(entry.dockpartId ?? "");
		return id !== "" && id !== self && siblings.some((sibling) => String(sibling.id) === id);
	});
}

export function refillEmptyBasedOn(
	parts: Array<{
		id: string | number;
		type?: string;
		protocol?: string;
		basedOn: {
			length: number;
			map: (fn: (entry: { dockpartId?: string | number }) => { dockpartId: string }) => { dockpartId: string }[];
			replace: (entries: DockpartBasedOnEntry[]) => void;
		};
	}>,
	schemas: DockpartSchemaStackInfo[]
): void {
	const siblings: DockpartStackRef[] = parts.map((part) => ({
		id: part.id,
		type: part.type,
		protocol: part.protocol,
	}));
	for (const part of parts) {
		const current = part.basedOn.map((entry) => ({ dockpartId: String(entry.dockpartId ?? "") }));
		if (basedOnEntriesAreValid(current, siblings, part.id)) {
			continue;
		}
		part.basedOn.replace(
			resolveBasedOnFromSiblings(
				part.type || part.protocol || "",
				siblings,
				schemas,
				part.id
			)
		);
	}
}

export function sortSchemaIdsByStack(
	schemaIds: string[],
	schemas: DockpartSchemaStackInfo[]
): string[] {
	return [...schemaIds].sort((left, right) => {
		const leftSchema = findDockpartSchema(left, schemas);
		const rightSchema = findDockpartSchema(right, schemas);
		const leftRank = dockpartStackRank(leftSchema?.type ?? left);
		const rightRank = dockpartStackRank(rightSchema?.type ?? right);
		if (leftRank !== rightRank) {
			return leftRank - rightRank;
		}
		return left.localeCompare(right);
	});
}
