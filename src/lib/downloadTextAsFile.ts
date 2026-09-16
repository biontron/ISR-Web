export function downloadTextAsFile(filename: string, content: string, mimeType = "application/xml"): void {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}

export function downloadBytesAsFile(
	filename: string,
	bytes: Uint8Array,
	mimeType = "application/octet-stream"
): void {
	const blob = new Blob([bytes], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}
