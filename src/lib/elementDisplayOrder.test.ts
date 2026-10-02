import { moveSelectedIds, orderAfterAssign, orderByChildSequence } from "./elementDisplayOrder";

function named(id: string, name: string) {
	return { id, definition: { name } };
}

describe("elementDisplayOrder", () => {
	it("lässt ohne gespeicherte Folge die gegebene Reihenfolge stehen", () => {
		const ordered = orderByChildSequence(
			[named("b", "Zeta"), named("a", "Alpha")],
			null
		);
		expect(ordered.map((item) => item.id)).toEqual(["b", "a"]);
	});

	it("lässt eine Hand-Reihenfolge stehen und hängt neue Ids in ihrer Folge hinten an", () => {
		const ordered = orderByChildSequence(
			[named("m", "Mitte"), named("a", "Alpha"), named("z", "Zeta")],
			["z"]
		);
		expect(ordered.map((item) => item.id)).toEqual(["z", "m", "a"]);
	});

	it("hängt Zuordnungen an, ohne die Liste alphabetisch zu sortieren", () => {
		const first = orderAfterAssign([], [named("z", "Zeta"), named("a", "Alpha")]);
		expect(first.map((item) => item.id)).toEqual(["z", "a"]);
		const next = orderAfterAssign(first, [named("m", "Mitte")]);
		expect(next.map((item) => item.id)).toEqual(["z", "a", "m"]);
	});

	it("schiebt eine zusammenhängende Auswahl als Block", () => {
		expect(moveSelectedIds(["a", "b", "c"], new Set(["b", "c"]), -1)).toEqual(["b", "c", "a"]);
		expect(moveSelectedIds(["b", "c", "a"], new Set(["b", "c"]), 1)).toEqual(["a", "b", "c"]);
	});
});
