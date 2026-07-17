import { types } from "mobx-state-tree";
import { getValueByPath, removeValueByPath, setValueByPath, appendValueToArrayByPath } from "./path";

const Host = types
	.model("Host", {
		entries: types.optional(types.array(types.frozen()), []),
	})
	.actions((self) => ({
		removeAt(index: number) {
			removeValueByPath(self, "entries", index);
		},
	}));

const FrozenParentHost = types
	.model("FrozenParentHost", {
		parent: types.optional(types.frozen(), {}),
	})
	.actions((self) => ({
		seed() {
			self.parent = { whitelist: [{ type: "ROOT" }] };
		},
		removeWhitelistEntry() {
			removeValueByPath(self, "parent.whitelist", 0);
		},
		addWhitelistEntry() {
			appendValueToArrayByPath(self, "parent.whitelist", { type: "NEW" });
		},
	}));

describe("setValueByPath", () => {
	it("aktualisiert verschachtelte Felder in types.map(types.frozen())", () => {
		const DockpartHost = types
			.model("DockpartHost", {
				settings: types.optional(types.map(types.frozen()), {}),
			})
			.actions((self) => ({
				seed() {
					self.settings.set("address", { type: "V4", netmask: "24", ip: "" });
				},
				setIp(ip: string) {
					setValueByPath(self, "settings.address.ip", ip);
				},
			}));

		const host = DockpartHost.create({});
		host.seed();
		host.setIp("192.168.1.10");

		expect(getValueByPath(host, "settings.address.ip")).toBe("192.168.1.10");
		expect(getValueByPath(host, "settings.address")).toEqual({
			type: "V4",
			netmask: "24",
			ip: "192.168.1.10",
		});
	});
});

describe("removeValueByPath", () => {
	it("entfernt Einträge aus MST-Arrays per splice", () => {
		const host = Host.create({
			entries: [{ kind: "group", order: 1 }],
		});

		host.removeAt(0);

		expect(getValueByPath(host, "entries")).toEqual([]);
	});

	it("entfernt Einträge aus per setValueByPath angelegten Plain-Arrays", () => {
		const host: Record<string, unknown> = {};
		setValueByPath(host, "whitelist", [{ type: "ROOT" }]);

		removeValueByPath(host, "whitelist", 0);

		expect(getValueByPath(host, "whitelist")).toBeUndefined();
	});

	it("entfernt Einträge aus Arrays in types.frozen()-Objekten", () => {
		const host = FrozenParentHost.create({});
		host.seed();

		host.removeWhitelistEntry();

		expect(getValueByPath(host, "parent.whitelist")).toBeUndefined();
	});
});

describe("appendValueToArrayByPath", () => {
	it("hängt Einträge in Arrays in types.frozen()-Objekten ein", () => {
		const host = FrozenParentHost.create({});
		host.seed();

		host.addWhitelistEntry();

		expect(getValueByPath(host, "parent.whitelist")).toEqual([
			{ type: "ROOT" },
			{ type: "NEW" },
		]);
	});
});
