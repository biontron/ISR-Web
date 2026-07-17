import { getRoot, Instance, types } from "mobx-state-tree";
import { ITreeNode } from "../../Interfaces/Tree";
import { AssetModel, IAsset } from "./Asset.Model";
import { DockModel } from "./Dock.Model";

/**
 * A single assets details with properties. Has actually the same id as the asset
 */
export const AssetDetailsModel = types
	.model("AssetDetailsModel", {
		id: types.maybeNull(types.reference(types.late(() => AssetModel))),
		definition: types.model({
			baseType: types.string, // types.safeReference(types.late(() => SchemaModel)),
			type: types.optional(types.string, ""),
			subType: types.string,
			name: types.string,
			label: types.string,
			description: types.string,
		}),
		ownerIdRef: types.maybeNull(types.reference(types.late(() => AssetModel))),
		docks: types.optional(types.array(DockModel), []),
		attachments: types.array(types.frozen()),
		properties: types.model({
			responsibles: types.array(
				types.model({
					givenName: types.string,
					familyName: types.string,
					email: types.string,
					phone: types.string,
				}),
			),
			notations: types.frozen(),
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
	.volatile(() => ({
		status: "untouched" as "new" | "edit" | "changed" | "untouched",
	}))
	.actions((self) => ({
		setStatus(newStatus: "new" | "edit" | "changed" | "untouched") {
		  self.status = newStatus;
		},
	}))
	.views((self) => ({
		/**
     * Provide the Object Type
     */
		get class(): string {
			return "AssetDetails";
		},

		/**
     * Generates the children of the asset's details - if full is true, it will also generate the children of the children
     * @param {boolean} [full=true]
     * @returns {*}
     */
		childrenAsTreeNodes(): ITreeNode[] {
			const root = getRoot(self) as any;

			const childrenAssets = root.assets.assets.filter((asset: IAsset) => {
				return self.id === asset.ownerIdRef;
			});

			// console.log("Asset.Model - AssetDetails: childrenAssets", toJS(childrenAssets), self.id, self.definition.name);

			// Generating the tree node

			return childrenAssets.map((element: any) => {
				if (!element) {
					return {
						key: "",
						class: "ASSET",
						title: "ERROR",
						children: [],
						icon: null,
					};
				}
				return {
					key: element.id ?? "",
					title:
            element.definition?.name ?? "" + element.definition?.title ?? "",
					children: element ? element?.childrenAsTreeNodes() : [],
					icon: root.configSchemas.getIconByDefinition(element.definition),
					class: element.class,
					description: element?.definition.description,
				};
			});
		},

		/**
     * Provides all kind of its children (as full data set)
     */
		children(): IAsset[] {
			const root = getRoot(self) as any;

			const childrenAssets = root.assets.assets.filter((asset: IAsset) => {
				return self.id === asset.ownerIdRef;
			});

			return childrenAssets;
		},
	}));

export interface IAssetDetails extends Instance<typeof AssetDetailsModel> {}
