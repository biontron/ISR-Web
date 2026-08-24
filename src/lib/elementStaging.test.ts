import { touchKindFromStatus, isNewElementStatus, nextTouchedStatus } from "./elementStaging";

describe("elementStaging", () => {
	it("behandelt invalid mit vorherigem new weiterhin als create", () => {
		expect(touchKindFromStatus("invalid", "new")).toBe("create");
		expect(isNewElementStatus("invalid", "new")).toBe(true);
	});

	it("behandelt invalid mit vorherigem changed als update", () => {
		expect(touchKindFromStatus("invalid", "changed")).toBe("update");
		expect(isNewElementStatus("invalid", "changed")).toBe(false);
	});

	it("lässt new und invalid beim Mutieren unangetastet (POST statt PUT)", () => {
		expect(nextTouchedStatus("new")).toBe("new");
		expect(nextTouchedStatus("invalid")).toBe("invalid");
		expect(touchKindFromStatus(nextTouchedStatus("new"))).toBe("create");
		expect(touchKindFromStatus(nextTouchedStatus("invalid"), "new")).toBe("create");
	});

	it("markiert bestehende Elemente als changed / update", () => {
		expect(nextTouchedStatus("edit")).toBe("changed");
		expect(nextTouchedStatus("untouched")).toBe("changed");
		expect(nextTouchedStatus("changed")).toBe("changed");
		expect(touchKindFromStatus(nextTouchedStatus("edit"))).toBe("update");
	});
});
