/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { useState } from "react";
import { observer } from "mobx-react";
import { Transfer } from "antd";
import type { TransferProps } from "antd";
import { rootStore } from "../../../../Stores/Root.Store";
import { ActiveElement } from "../../../../Interfaces/Element";
import SchemaSvgIcon from "../../SchemaSvgIcon";
import { useLangtext } from "../../../../lib/common";
import {
	collectAssignedChildElements,
	collectAvailableChildElements,
	isLogicalViewGroupElement,
	LinkedChildElement,
	resolveElementRefId,
	toPlainElementIdRefs,
} from "../../../../lib/elementChildLinks";

interface TransferItem {
	key: string;
	title: string;
	baseType: string;
	description: string;
	icon: string | undefined;
}

function toTransferItem(item: LinkedChildElement): TransferItem {
	return {
		key: item.id,
		title: item.definition.name,
		baseType: item.definition.baseType,
		description: item.definition.description,
		icon: rootStore.configSchemas.getIconByDefinition(item.definition),
	};
}

function setParentRef(child: LinkedChildElement, parentId: string | null) {
	child.beginEdit();
	if (child.class === "Asset") {
		child.setValueByPath("ownerIdRef", parentId);
	} else {
		child.setValueByPath("parentIdRef", parentId ?? undefined);
	}
}

function findMappableElement(id: string): LinkedChildElement | undefined {
	return (
		rootStore.assets.assets.find((asset) => asset.id === id) ??
		rootStore.groups.groups.find((group) => group.id === id)
	);
}

const ElementChildMapping: React.FC<{ element: ActiveElement }> = observer(({ element }) => {
	const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
	const langtext = useLangtext();

	const assignedElements = element
		? collectAssignedChildElements(rootStore, element)
		: [];
	const assignedIds = new Set(assignedElements.map((item) => item.id));
	const availableElements = element
		? collectAvailableChildElements(rootStore, element.id, assignedIds)
		: [];
	const data = [...assignedElements, ...availableElements].map(toTransferItem);
	const targetKeys = assignedElements.map((item) => item.id);

	const persistElementIdRefs = (nextIds: Set<string>) => {
		if (!element || !("elementIdRefs" in element) || !element.elementIdRefs) {
			return;
		}
		const nextRefs = toPlainElementIdRefs(element.elementIdRefs)
			.map((ref) => resolveElementRefId(ref))
			.filter((id): id is string => !!id && nextIds.has(id))
			.map((id) => ({ id }));
		const model = element as { setElementIdRefs?: (refs: Array<{ id: string }>) => void };
		if (typeof model.setElementIdRefs === "function") {
			model.setElementIdRefs(nextRefs);
		}
	};

	const handleChange = (nextTargetKeys: React.Key[]) => {
		if (!element) {
			return;
		}
		const nextAssigned = new Set(nextTargetKeys.map(String));
		const previousAssigned = assignedIds;

		Array.from(nextAssigned).forEach((id) => {
			if (previousAssigned.has(id)) {
				return;
			}
			const child = findMappableElement(id);
			if (child) {
				setParentRef(child, element.id);
			}
		});

		Array.from(previousAssigned).forEach((id) => {
			if (nextAssigned.has(id)) {
				return;
			}
			const child = findMappableElement(id);
			if (child) {
				setParentRef(child, null);
			}
		});

		if (isLogicalViewGroupElement(element)) {
			persistElementIdRefs(nextAssigned);
		}
	};

	const handleSelectChange = (sourceSelectedKeys: React.Key[], targetSelectedKeys: React.Key[]) => {
		setSelectedKeys([...sourceSelectedKeys, ...targetSelectedKeys].map(String));
	};

	const handleSearch: TransferProps<TransferItem>["onSearch"] = (dir, value) => {
		console.log("search:", dir, value);
	};

	return (
		<Transfer
			dataSource={data}
			titles={[langtext("general.elementchilds_available"), langtext("general.elementchilds_assigned")]}
			targetKeys={targetKeys}
			selectedKeys={selectedKeys}
			onChange={handleChange}
			onSelectChange={handleSelectChange}
			onSearch={handleSearch}
			rowKey={(item) => item.key}
			render={(item) => (
				<>
					<SchemaSvgIcon svgString={item.icon} element={{}} /> {item.title}
					<br />
					{"<"}
					{item.baseType}
					{">"}
					{item.description}
				</>
			)}
			listStyle={{
				height: 300,
				width: "100%",
			}}
			disabled={false}
			showSelectAll={true}
			style={{ width: "100%" }}
		/>
	);
});

export default ElementChildMapping;
