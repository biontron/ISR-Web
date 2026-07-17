import JSZip from "jszip";
import { ActivityStatusRow } from "./activityStatusOverview";

function safeFilename(row: ActivityStatusRow): string {
	const base = `${row.kind}-${row.itemId}`.replace(/[^a-zA-Z0-9._-]+/g, "_");
	return `${base}.json`;
}

export async function exportActivityStatusZip(rows: ActivityStatusRow[]): Promise<void> {
	const zip = new JSZip();

	const manifest = rows.map((row) => ({
		kind: row.kind,
		name: row.name,
		activity: row.activity,
		itemId: row.itemId,
		httpStatus: row.httpStatus ?? null,
		url: row.rest.fullUrl,
		method: row.rest.method,
		errorMessage: row.errorMessage ?? null,
		timestamp: new Date().toISOString(),
	}));

	zip.file("manifest.json", JSON.stringify(manifest, null, 2));

	for (const row of rows) {
		const payload = row.rest.payload ?? row.rest.responseBody ?? {};
		zip.file(safeFilename(row), JSON.stringify(payload, null, 2));
	}

	const blob = await zip.generateAsync({ type: "blob" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = `activity-status-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.zip`;
	anchor.click();
	URL.revokeObjectURL(url);
}
