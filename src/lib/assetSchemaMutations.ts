import { ISchemaGroupModel } from "../Stores/Models/SchemaGroup.Model";
import { IAsset } from "../Stores/Models/Asset.Model";
import { getValueByPath } from "./path";
import { buildDefaultEntryFromSchemaItems } from "./schemaEntryDefaults";
import { createNewDockpartSnapshot } from "./dockpartSchemaResolve";
import { IRootStore } from "../Stores/Root.Store";
import { resolveFieldValueOnAdd } from "./schemaAddFieldDefaults";

export function isDockpartsChooseGroup(group: ISchemaGroupModel): boolean {
	return (
		group.dataStructure.itemName === "dockparts" &&
		group.items.length === 0 &&
		group.collectionType === "array"
	);
}

export function needsChooseOnAdd(group: ISchemaGroupModel): boolean {
	return isDockpartsChooseGroup(group);
}

function parseDockIndexFromPath(path: string): number | undefined {
	const match = path.match(/^docks\[(\d+)\]\.dockparts$/);
	if (!match) {
		return undefined;
	}
	return parseInt(match[1], 10);
}

export function buildDockEntryFromSchemaItems(
	asset: IAsset,
	arrayPath: string,
	schemaItems: ISchemaGroupModel["items"]
): Record<string, unknown> {
	const entry = buildDefaultEntryFromSchemaItems(schemaItems as any, {
		element: asset,
		dataPathPrefix: arrayPath.replace(/\[\d+\]$/, ""),
		siblingArrayPath: arrayPath,
	});

	if (entry.id == null || entry.id === "") {
		entry.id = resolveFieldValueOnAdd(
			{
				dataStructure: { itemName: "id", default: "" },
				rules: "^D-[A-Za-z0-9]{22}$",
			} as any,
			{
				element: asset,
				dataPathPrefix: arrayPath,
				siblingArrayPath: arrayPath,
			}
		);
	}

	if (entry.type == null) {
		entry.type = "";
	}

	if (!Array.isArray(entry.dockparts)) {
		entry.dockparts = [];
	}

	return entry;
}

export function buildDockpartEntry(
	asset: IAsset,
	dockIndex: number,
	schemaId: string,
	root: IRootStore
): Record<string, unknown> {
	const dock = asset.docks[dockIndex];
	const siblingPath = `docks[${dockIndex}].dockparts`;
	const existingIds = dock.dockparts.map((part) => String(part.id));
	const partId =
		resolveFieldValueOnAdd(
			{
				dataStructure: { itemName: "id", default: "" },
				rules: "^([1-9][0-9]?)$",
			} as any,
			{
				element: asset,
				dataPathPrefix: siblingPath,
				siblingArrayPath: siblingPath,
			}
		) ?? String(existingIds.length + 1);

	return createNewDockpartSnapshot(
		schemaId,
		String(partId),
		root.configSchemas.dockparts.slice()
	);
}

export function tryAssetArrayAdd(
	asset: IAsset,
	path: string,
	group: ISchemaGroupModel,
	root: IRootStore
): Record<string, unknown> | undefined | "choose" {
	if (asset.class !== "Asset") {
		return undefined;
	}

	if (needsChooseOnAdd(group)) {
		return "choose";
	}

	if (path === "docks") {
		return buildDockEntryFromSchemaItems(asset, path, group.items);
	}

	return buildDefaultEntryFromSchemaItems(group.items as any, {
		element: asset,
		dataPathPrefix: path,
		siblingArrayPath: path,
	});
}

export function tryAssetDockpartAdd(
	asset: IAsset,
	path: string,
	schemaId: string,
	root: IRootStore
): Record<string, unknown> | undefined {
	const dockIndex = parseDockIndexFromPath(path);
	if (dockIndex === undefined || !asset.docks[dockIndex]) {
		return undefined;
	}
	return buildDockpartEntry(asset, dockIndex, schemaId, root);
}

export function tryAssetArrayRemove(asset: IAsset, path: string, index: number): boolean {
	if (asset.class !== "Asset") {
		return false;
	}

	if (path === "docks") {
		asset.removeDock(index);
		return true;
	}

	const dockpartMatch = path.match(/^docks\[(\d+)\]\.dockparts$/);
	if (dockpartMatch) {
		asset.removeDockpart(parseInt(dockpartMatch[1], 10), index);
		return true;
	}

	return false;
}

export function tryAssetMstAppend(
	asset: IAsset,
	path: string,
	entry: Record<string, unknown>
): boolean {
	if (path === "docks") {
		asset.appendDockEntry(entry);
		return true;
	}

	const dockpartMatch = path.match(/^docks\[(\d+)\]\.dockparts$/);
	if (dockpartMatch) {
		asset.appendDockpartEntry(parseInt(dockpartMatch[1], 10), entry);
		return true;
	}

	return false;
}
