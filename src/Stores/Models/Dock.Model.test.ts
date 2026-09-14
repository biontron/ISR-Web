import { getSnapshot } from "mobx-state-tree";
import { DockpartModel } from "./Dock.Model";

describe("DockpartModel", () => {
	it("schreibt version, nicht versions[]", () => {
		const part = DockpartModel.create({
			id: "1",
			type: "IP",
			version: "4",
			versions: [{ version: "4" }],
		} as any);
		const snapshot = getSnapshot(part);
		expect(snapshot.version).toBe("4");
		expect("versions" in snapshot).toBe(false);
	});
});
