import { TreeElement } from "../Interfaces/Element";
import { ITreeNode } from "../Interfaces/Tree";
import { IRootStore } from "../Stores/Root.Store";
import {
	ElementDefinitionTypeFields,
	resolveElementKindDisplay,
	resolveElementTypeDisplay,
} from "./elementDefinitionTypes";

export type TreeNodeInfoRow = {
	label: string;
	value: string;
};

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function buildTreeNodeInfoRows(
	root: IRootStore,
	nodeData: Pick<
	ITreeNode,
	"key" | "class" | "title" | "label" | "description" | "status" | "baseType" | "subType" | "elementType" | "storeType"
	>,
	definition?: ElementDefinitionTypeFields
): TreeNodeInfoRow[] {
	const schemas = root.configSchemas.schemaCompat;
	const resolvedDefinition =
		definition ??
		({
			baseType: nodeData.baseType,
			type: nodeData.elementType,
			subType: nodeData.subType,
			storeType: nodeData.storeType,
		} as ElementDefinitionTypeFields);

	return [
		{ label: "storeType", value: resolvedDefinition?.storeType ?? "—" },
		{
			label: "baseType",
			value: String(resolveElementKindDisplay(resolvedDefinition, nodeData.class) || "—"),
		},
		{ label: "Typ", value: resolveElementTypeDisplay(resolvedDefinition, schemas) || "—" },
		{ label: "Subtyp", value: resolvedDefinition?.subType ?? "—" },
		{ label: "Name", value: String(nodeData.title ?? "—") },
		{ label: "Label", value: String(nodeData.label ?? "—") },
		{ label: "Descripton", value: String(nodeData.description ?? "—") },
		{ label: "ID", value: String(nodeData.key ?? "—") },
		{ label: "Status", value: String(nodeData.status ?? "—") },
	];
}

export function buildGraphNodeHoverHtml(root: IRootStore, element: TreeElement): string {
	const definition = element.definition;
	const nodeData = {
		key: element.id,
		class: element.class,
		title: definition?.name,
		label: "label" in definition ? String(definition.label ?? "") : "",
		description: definition?.description,
		status: element.status,
		baseType: definition?.baseType,
		subType: definition?.subType,
		elementType: definition?.type,
		storeType: definition?.storeType,
	};
	const rows = buildTreeNodeInfoRows(root, nodeData, definition);
	const infoTitle = `${nodeData.class ?? "???"} — ${nodeData.title ?? "???"}`;

	const rowHtml = rows
		.map(
			(row) =>
				`<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value ?? "—")}</td></tr>`
		)
		.join("");

	return `
		<div class="graph-node-tooltip">
			<div class="graph-node-tooltip__title element-info-title">${escapeHtml(infoTitle)}</div>
			<table class="graph-node-tooltip__table element-info-descriptions">
				<tbody>${rowHtml}</tbody>
			</table>
		</div>`;
}

export type TreeNodeSegment = "viewGroup" | "component";

/** Tree-Segment: storeType VIEWGROUP/GROUP (Legacy) = blaue View-Gruppe; sonst Komponente (gelb). */
export function resolveTreeNodeSegment(
	definition: ElementDefinitionTypeFields | undefined,
	elementClass?: string
): TreeNodeSegment {
	const storeType = definition?.storeType?.trim().toUpperCase() ?? "";
	if (storeType === "VIEWGROUP" || storeType === "GROUP") {
		return "viewGroup";
	}
	if (storeType === "COMPONENT") {
		return "component";
	}
	if (elementClass === "View" || elementClass === "Group") {
		if (storeType === "INTERNAL" || storeType === "") {
			return "viewGroup";
		}
	}
	return "component";
}

export function treeNodeSegmentClassName(segment: TreeNodeSegment): string {
	return segment === "viewGroup" ? "tree-node--view-group" : "tree-node--component";
}

/** Löst Baum-Knoten über Store-Listen — volle definition wie im Graph. */
export function resolveTreeElement(
	root: IRootStore,
	nodeData: ITreeNode
): TreeElement | undefined {
	const key = nodeData.key?.trim();
	if (!key) {
		return undefined;
	}

	const asset = root.assets.assets.find((item) => item.id === key);
	if (asset) {
		return asset;
	}

	const group = root.groups.groups.find((item) => item.id === key);
	if (group) {
		return group;
	}

	return root.views.views.find((view) => view.id === key);
}

export function resolveTreeNodeDefinition(
	root: IRootStore,
	nodeData: ITreeNode
): ElementDefinitionTypeFields | undefined {
	const element = resolveTreeElement(root, nodeData);
	if (element?.definition) {
		return element.definition;
	}

	return {
		baseType: nodeData.baseType,
		type: nodeData.elementType,
		subType: nodeData.subType,
		storeType: nodeData.storeType,
	};
}

export function resolveTreeNodeElementType(
	root: IRootStore,
	definition: ElementDefinitionTypeFields | undefined
): string {
	return resolveElementTypeDisplay(definition, root.configSchemas.schemaCompat);
}

type TreeAssignableElement = {
	id: string;
	class?: string;
	status?: string;
	definition?: ElementDefinitionTypeFields & {
		name?: string;
		label?: string;
		description?: string;
	};
	childrenAsTreeNodes: () => ITreeNode[];
};

export function assignableElementToTreeNode(
	root: IRootStore,
	element: TreeAssignableElement
): ITreeNode {
	const definition = element.definition;
	return {
		key: element.id,
		class: element.class,
		title: definition?.name ?? "",
		storeType: definition?.storeType,
		baseType: definition?.baseType,
		subType: definition?.subType,
		elementType: resolveTreeNodeElementType(root, definition) || definition?.type,
		description: definition?.description,
		label: definition?.label ?? "",
		status: element.status,
		children: element.childrenAsTreeNodes(),
	};
}
