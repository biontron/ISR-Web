export function iacTemplateSelectionKey(packageName: string, templateName: string): string {
	return `${packageName}::${templateName}`;
}

export function parseIacTemplateSelectionKey(
	key: string
): { packageName: string; templateName: string } | null {
	const separator = key.indexOf("::");
	if (separator <= 0) {
		return null;
	}
	return {
		packageName: key.slice(0, separator),
		templateName: key.slice(separator + 2),
	};
}
