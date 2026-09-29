import { operationalStatusLabel } from "./operationalStatus";

describe("operationalStatusLabel", () => {
	it("zeigt die vier Betriebszustände", () => {
		expect(operationalStatusLabel("online")).toBe("online");
		expect(operationalStatusLabel("active")).toBe("aktiv");
		expect(operationalStatusLabel("absent")).toBe("abwesend");
		expect(operationalStatusLabel("n/a")).toBe("n/a");
		expect(operationalStatusLabel(undefined)).toBe("n/a");
	});
});
