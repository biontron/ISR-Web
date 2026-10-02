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

	it("schreibt inheritance und nicht valueRef", () => {
		const part = DockpartModel.create({
			id: "1",
			type: "VLAN",
			inheritance: "ctx#v10",
			valueRef: "alt#x",
		} as any);
		const snapshot = getSnapshot(part);
		expect(snapshot.inheritance).toBe("ctx#v10");
		expect("valueRef" in snapshot).toBe(false);
	});
});
