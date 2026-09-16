import { addXPathFilterRule, toAssetElementIdRef } from "./elementAssignments";
import {
	activatedFilterRules,
	applyAutomappingToParent,
	applyAutomappingToViewGroups,
} from "./elementAutomapping";

function device(id: string, extras: Record<string, unknown> = {}) {
	return {
		id,
		class: "Asset" as const,
		ownerIdRef: extras.ownerIdRef ?? null,
		environmentId: extras.environmentId ?? "office",
		definition: {
			storeType: "COMPONENT",
			baseType: "COMPONENT",
			type: extras.type ?? "DEVICE",
			subType: extras.subType ?? "DESKTOP",
			name: String(extras.name ?? id),
			label: "",
			description: "",
			tags: [],
		},
	};
}

describe("elementAutomapping", () => {
	it("stempelt ElementIdRefType an neue elementIdRefs", () => {
		expect(toAssetElementIdRef(device("a-1") as never)).toEqual({
			environmentId: "office",
			id: "a-1",
			baseType: "COMPONENT",
			type: "DEVICE",
			subType: "DESKTOP",
			name: "a-1",
			label: "",
		});
	});

	it("wendet nur aktivierte Regeln an und schreibt ElementIdRefType", () => {
		const parent = {
			id: "g1",
			class: "Group",
			filterRules: addXPathFilterRule(
				[],
				"definition/type='DEVICE'",
				"Geräte",
				[{ ref: "office" }],
				true
			),
			elementIdRefs: [] as ReturnType<typeof toAssetElementIdRef>[],
			setElementIdRefs(refs: ReturnType<typeof toAssetElementIdRef>[]) {
				this.elementIdRefs = refs;
			},
		};
		const root = {
			groups: { groups: [parent] },
			assets: {
				assets: [
					device("a-office", { environmentId: "office" }),
					device("a-home", { environmentId: "home" }),
					device("a-printer", { type: "PRINTER", subType: "PRINTER", environmentId: "office" }),
				],
			},
		} as any;

		const result = applyAutomappingToParent(root, parent, { unlinkedOnly: true });
		expect(result.added).toBe(1);
		expect(parent.elementIdRefs).toEqual([toAssetElementIdRef(device("a-office") as never)]);
	});

	it("ignoriere deaktivierte Regeln", () => {
		expect(
			activatedFilterRules([
				{ xpath: "definition/type='DEVICE'", description: "Geräte", activated: false },
				{ xpath: "definition/subType='DESKTOP'", description: "Desktop", activated: true },
			]).map((rule) => rule.xpath)
		).toEqual(["definition/subType='DESKTOP'"]);
	});

	it("übernimmt Automapping über alle View-Gruppen", () => {
		const g1 = {
			id: "g1",
			class: "Group",
			parentIdRef: "view1",
			filterRules: addXPathFilterRule([], "definition/subType='DESKTOP'", "Desktops", [], true),
			elementIdRefs: [] as ReturnType<typeof toAssetElementIdRef>[],
			setElementIdRefs(refs: ReturnType<typeof toAssetElementIdRef>[]) {
				this.elementIdRefs = refs;
			},
		};
		const g2 = {
			id: "g2",
			class: "Group",
			parentIdRef: "view1",
			filterRules: [],
			elementIdRefs: [] as ReturnType<typeof toAssetElementIdRef>[],
			setElementIdRefs(refs: ReturnType<typeof toAssetElementIdRef>[]) {
				this.elementIdRefs = refs;
			},
		};
		const root = {
			groups: { groups: [g1, g2] },
			assets: {
				assets: [device("a-free", { environmentId: "office" })],
			},
		} as any;

		const result = applyAutomappingToViewGroups(root, "view1");
		expect(result).toEqual({ added: 1, groups: 1 });
		expect(g1.elementIdRefs).toEqual([toAssetElementIdRef(device("a-free") as never)]);
		expect(g2.elementIdRefs).toEqual([]);
	});
});
