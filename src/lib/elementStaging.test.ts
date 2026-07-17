import { touchKindFromStatus, isNewElementStatus } from "./elementStaging";

describe("elementStaging", () => {
	it("behandelt invalid mit vorherigem new weiterhin als create", () => {
		expect(touchKindFromStatus("invalid", "new")).toBe("create");
		expect(isNewElementStatus("invalid", "new")).toBe(true);
	});

	it("behandelt invalid mit vorherigem changed als update", () => {
		expect(touchKindFromStatus("invalid", "changed")).toBe("update");
		expect(isNewElementStatus("invalid", "changed")).toBe(false);
	});
});
