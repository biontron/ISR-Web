const VALUE_REF_SEPARATOR = "#";

export type ParsedValueRef = {
	contextId: string;
	valueId: string;
};

export function formatValueRef(contextId: string, valueId: string): string {
	return `${contextId}${VALUE_REF_SEPARATOR}${valueId}`;
}

export function parseValueRef(ref: string | undefined | null): ParsedValueRef | undefined {
	if (!ref || typeof ref !== "string") {
		return undefined;
	}
	const trimmed = ref.trim();
	const hashIndex = trimmed.indexOf(VALUE_REF_SEPARATOR);
	if (hashIndex <= 0 || hashIndex >= trimmed.length - 1) {
		return undefined;
	}
	return {
		contextId: trimmed.slice(0, hashIndex),
		valueId: trimmed.slice(hashIndex + 1),
	};
}
