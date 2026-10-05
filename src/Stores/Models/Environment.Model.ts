/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0
*/
import { Instance, types } from "mobx-state-tree";

export const EnvironmentModel = types
	.model("Environment", {
		id: types.identifier,
		definition: types.optional(
			types.model({
				baseType: types.optional(types.string, "ENVIRONMENT"),
				subType: types.optional(types.string, ""),
				name: types.optional(types.string, ""),
			}),
			{}
		),
		properties: types.optional(
			types.model({
				bgColor: types.optional(types.string, ""),
				responsibles: types.optional(types.frozen(), []),
				notations: types.optional(types.frozen(), []),
				ignoredDevices: types.optional(types.array(types.string), []),
				graph: types.maybe(types.frozen()),
			}),
			{}
		),
	})
	.volatile(() => ({
		status: "untouched" as "untouched" | "changed",
		ignoredDevicesSnapshot: null as string[] | null,
		graphSnapshot: undefined as unknown,
		graphSnapshotTaken: false,
	}))
	.actions((self) => ({
		setName(name: string) {
			self.definition.name = name;
		},
		setGraphRepresentations(representations: readonly unknown[]) {
			if (!self.graphSnapshotTaken) {
				self.graphSnapshot = self.properties.graph;
				self.graphSnapshotTaken = true;
			}
			self.properties.graph = { representations: representations.slice() };
			self.status = "changed";
		},
		setIgnoredDevices(names: readonly string[]) {
			const next = compactIgnoredDeviceNames(names);
			const baseline = self.ignoredDevicesSnapshot ?? self.properties.ignoredDevices.slice();
			if (ignoredDeviceListsEqual(next, baseline)) {
				self.properties.ignoredDevices.replace(baseline.slice());
				self.ignoredDevicesSnapshot = null;
				self.status = self.graphSnapshotTaken ? "changed" : "untouched";
				return;
			}
			if (self.ignoredDevicesSnapshot === null) {
				self.ignoredDevicesSnapshot = self.properties.ignoredDevices.slice();
			}
			self.properties.ignoredDevices.replace(next);
			self.status = "changed";
		},
		commitIgnoredDevices() {
			self.ignoredDevicesSnapshot = null;
			self.graphSnapshot = undefined;
			self.graphSnapshotTaken = false;
			self.status = "untouched";
		},
		rollbackIgnoredDevices() {
			if (self.ignoredDevicesSnapshot) {
				self.properties.ignoredDevices.replace(self.ignoredDevicesSnapshot.slice());
			}
			self.ignoredDevicesSnapshot = null;
			if (self.graphSnapshotTaken) {
				self.properties.graph = self.graphSnapshot;
				self.graphSnapshot = undefined;
				self.graphSnapshotTaken = false;
			}
			self.status = "untouched";
		},
	}));

function compactIgnoredDeviceNames(names: readonly string[]): string[] {
	const seen = new Set<string>();
	const next: string[] = [];
	for (const raw of names) {
		const name = raw.trim();
		const key = name.toLocaleLowerCase("de");
		if (!name || seen.has(key)) {
			continue;
		}
		seen.add(key);
		next.push(name);
	}
	return next;
}

function ignoredDeviceListsEqual(left: readonly string[], right: readonly string[]): boolean {
	if (left.length !== right.length) {
		return false;
	}
	for (let index = 0; index < left.length; index++) {
		if (left[index] !== right[index]) {
			return false;
		}
	}
	return true;
}

export interface IEnvironment extends Instance<typeof EnvironmentModel> {}

export function environmentRestProperties(environment: {
	properties: {
		bgColor: string;
		responsibles: unknown;
		notations: unknown;
		ignoredDevices: { slice(): readonly string[] };
		graph?: unknown;
	};
}): Record<string, unknown> {
	const properties: Record<string, unknown> = {
		bgColor: environment.properties.bgColor,
		responsibles: environment.properties.responsibles,
		notations: environment.properties.notations,
		ignoredDevices: environment.properties.ignoredDevices.slice(),
	};
	if (environment.properties.graph != null) {
		properties.graph = environment.properties.graph;
	}
	return properties;
}

export function environmentDisplayName(environment?: IEnvironment | null): string {
	const name = environment?.definition?.name?.trim();
	if (name) {
		return name;
	}
	return environment?.id ?? "—";
}
