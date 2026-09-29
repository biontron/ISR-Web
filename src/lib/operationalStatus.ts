/** Betriebsstatus aus der Resource `component-status`, nicht der Bearbeitungsstatus. */
export type OperationalStatus = "online" | "active" | "absent" | "n/a";

export function operationalStatusLabel(status: string | undefined): string {
	switch ((status ?? "").trim().toLowerCase()) {
		case "online":
			return "online";
		case "active":
		case "aktiv":
			return "aktiv";
		case "absent":
		case "abwesend":
		case "abwesende":
		case "offline":
			return "abwesend";
		case "n/a":
		case "na":
		case "unknown":
			return "n/a";
		default:
			return status?.trim() || "n/a";
	}
}
