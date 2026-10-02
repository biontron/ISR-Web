import { moveSelectedIds, orderAfterAssign, orderByChildSequence } from "./elementDisplayOrder";

function named(id: string, name: string) {
	return { id, definition: { name } };
}

describe("elementDisplayOrder", () => {
	it("sortiert ohne gespeicherte Folge alphabetisch", () => {
		const ordered = orderByChildSequence(
			[named("b", "Zeta"), named("a", "Alpha")],
			null
		);
		expect(ordered.map((item) => item.id)).toEqual(["a", "b"]);
	});

	it("lässt eine Hand-Reihenfolge stehen und hängt neue Ids hinten an", () => {
		const ordered = orderByChildSequence(
			[named("a", "Alpha"), named("m", "Mitte"), named("z", "Zeta")],
			["z", "a"]
		);
		expect(ordered.map((item) => item.id)).toEqual(["z", "a", "m"]);
	});

	it("sortiert die erste Zuordnung alphabetisch und hängt danach nur an", () => {
		const first = orderAfterAssign([], [named("z", "Zeta"), named("a", "Alpha")], false);
		expect(first.map((item) => item.id)).toEqual(["a", "z"]);
		const next = orderAfterAssign(first, [named("m", "Mitte")], true);
		expect(next.map((item) => item.id)).toEqual(["a", "z", "m"]);
	});

	it("schiebt eine zusammenhängende Auswahl als Block", () => {
		expect(moveSelectedIds(["a", "b", "c"], new Set(["b", "c"]), -1)).toEqual(["b", "c", "a"]);
		expect(moveSelectedIds(["b", "c", "a"], new Set(["b", "c"]), 1)).toEqual(["a", "b", "c"]);
	});
});
