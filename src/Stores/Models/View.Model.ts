/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import { Instance, cast, getRoot, types } from "mobx-state-tree";
import { IGroup } from "./Group.Model";
import ElementModel, { ElementDefinitionTagModel } from "./Element.Model";
import { buildElementTreeNodes } from "../../lib/elementTreeNodes";
import { FilterRuleModel } from "./FilterRule.Model";
import { ValidationRuleModel, ValidationRuleRecord } from "./ValidationRule.Model";
import { xpathRuleSnapshots } from "../../lib/xpathRule";
import { normalizeFilterRules, toFilterRuleRecord } from "../../lib/filterRuleNormalize";
import { resolvePrimaryEnvironmentRef } from "../../lib/viewEnvironments";


/**
 * A single view model (tree entry point)
 */
export const ViewModel = types.compose(
	ElementModel,
	types
		.model("View", {
			id: types.identifier,
			definition: types.model({
				storeType: types.optional(types.string, ""),
				baseType: types.string,
				type: types.optional(types.string, ""),
				subType: types.string,
				name: types.string,
				description: types.string,
				tags: types.optional(types.array(ElementDefinitionTagModel), []),
			}),
			environments: types.optional(
				types.array(
					types.model({
						ref: types.string,
						primary: types.optional(types.boolean, false),
					})
				),
				[]
			),
			filterRules: types.array(FilterRuleModel),
			validationRules: types.optional(types.array(ValidationRuleModel), []),
			attachments: types.array(types.frozen()),
			properties: types.model({
				responsibles: types.array(
					types.model({
						givenName: types.string,
						familyName: types.string,
						email: types.string,
						phone: types.string,
					})
				),
				notations: types.array(types.frozen()),
				style: types.model({
					bgColor: types.string,
					graph: types.model({
						layout: types.maybeNull(types.string),
					}),
				}),
			}),
			settings: types.map(types.frozen()),
		})
		// .volatile(() => ({ }))
		// .actions((self) => ({}))
		.views((self) => ({
			/**
			 * Provide the Object Type
			 */
			get class(): string {
				return "View";
			},

			/**
			 * Generates a tree node for the view
			 * @returns ITreeNode as stacked data structure for tree view
			 */
			childrenAsTreeNodes() {
				const root = getRoot(self) as any;
				if (!root.groups.groups) {
					return [{
						key: "",
						class: "VIEW",
						title: "ERROR VIEW",
						baseType: "NONE",
						subType: "NONE",
						description: "",
						status: "untouched",
						children: [],
					}];
				}
				return buildElementTreeNodes(root, self);
			},

			/**
			 * Provides all kind of its children (as full data set)
			 */
			children() {
				const root = getRoot(self) as any;
				const groups = root.groups.groups.filter(
					(element: IGroup) => element.parentIdRef === self.id
				);
				const assets = root.assets?.assetsByOwnerId?.get(self.id) ?? [];
				return [...groups, ...assets];
			},
		}))
).actions((self) => ({
	setDefinitionName(name: string) {
		self.beginEdit();
		self.definition.name = name;
		self.markTouched();
	},
	setEnvironments(bindings: Array<{ ref: string; primary?: boolean }>) {
		self.beginEdit();
		self.environments.replace(
			bindings
				.filter((entry) => entry.ref?.trim())
				.map((entry) => ({ ref: entry.ref.trim(), primary: Boolean(entry.primary) }))
		);
		self.markTouched();
	},
	setFilterRules(rules: unknown[]) {
		self.beginEdit();
		const root = getRoot(self) as { ui?: { activeView?: unknown } };
		const primary = resolvePrimaryEnvironmentRef(root.ui?.activeView ?? self);
		self.filterRules = cast(
			normalizeFilterRules(rules).map((rule) =>
				toFilterRuleRecord(
					rule.environments.length > 0 || !primary
						? rule
						: { ...rule, environments: [{ ref: primary }] }
				)
			)
		);
		self.markTouched();
	},
	setValidationRules(rules: ValidationRuleRecord[]) {
		self.beginEdit();
		self.validationRules = cast(xpathRuleSnapshots(rules));
		self.markTouched();
	},
}));

// Build custom resolver for Views - This is need to lazily set the activeView when the router changes
export const ViewLazyRef = types.maybeNull(
	types.safeReference(ViewModel, {
		// given an identifier, find the user
		get(identifier, parent: any) {
			const root = getRoot(parent) as any;
			return root.views.views.find((vType: IView) => vType.id === identifier) || null;
		},
		// given a user, produce the identifier that should be stored
		set(value: any) {
			return value.id as string;
		}
	})
);

// Typescript type / interface export
export interface IView extends Instance<typeof ViewModel> {}
