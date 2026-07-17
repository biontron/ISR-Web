/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { Transfer, Card } from "antd";
import type { TransferProps } from "antd";
import { rootStore } from "../../../../Stores/Root.Store";
import { ActiveElement } from "../../../../Interfaces/Element";
import { IGroup } from "../../../../Stores/Models/Group.Model";
import { IAsset } from "../../../../Stores/Models/Asset.Model";
import SchemaSvgIcon from "../../SchemaSvgIcon";
import { useLangtext } from "../../../../lib/common";

/**
 * Interface for transfer objects
 */
interface TransferItem {
	key: string;
	title: string;
	baseType: string;
	description: string;
	icon: string | undefined;
	chosen: boolean;
	// disabled: boolean;
}

const ElementChildMapping: React.FC<{ element: ActiveElement }> = observer(({ element }) => {
	const [targetKeys, setTargetKeys] = useState<string[]>([]);
	const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
	const [data, setData] = useState<TransferItem[]>([]);
	const langtext = useLangtext();

	useEffect(() => {
		const initData: TransferItem[] = [];
		// list of already connected / mapped child elements (to the current element)
		const connectedElements = [
			...rootStore.groups.groups.filter(
				(group: IGroup) => group.parentIdRef === element?.id
			),
			...rootStore.assets.assets.filter(
				(asset: IAsset) => asset.ownerIdRef === element?.id
			),
		];

		// list of available (unused elements) as list
		// these have been given free before (allowed types have to be taken from schema.parents)
		const potentialElements = [
			...rootStore.groups.groups.filter(
				(group: IGroup) => group.parentIdRef === undefined
			),
			...rootStore.assets.assets.filter(
				(asset: IAsset) => asset.ownerIdRef === undefined
			),
		];

		// view of already mapped elements for list
		connectedElements.forEach((item) => {
			initData.push({
				key: item.id,
				title: item.definition.name,
				baseType: item.definition.baseType,
				description: item.definition.description,
				icon: rootStore.configSchemas.getIconByDefinition(item.definition),
				chosen: true,
				// disabled: false,
			});
		});

		// view of available (unused) Mappings as list
		potentialElements.forEach((item) => {
			initData.push({
				key: item.id,
				title: item.definition.name,
				baseType: item.definition.baseType,
				description: item.definition.description,
				icon: rootStore.configSchemas.getIconByDefinition(item.definition),
				chosen: true,
				// disabled: false,
			});
		});

		// setData(initData);
		// Setze targetKeys (the connected Mappings) auf die IDs der verbundenen Elemente
		setTargetKeys(connectedElements.map((item) => item.id));
	}, [element, data]);

	const handleChange = (nextTargetKeys: string[], direction: string, moveKeys: string[]) => {
		setTargetKeys(nextTargetKeys);
		alert("direction=" + direction + " moveKeys=" + moveKeys.values.toString + " nextTargetKeys=" + nextTargetKeys);
		// element.addValueByPath(path, value);
		// element.removeValueByPath(path, value);
	};

	const handleSelectChange = (sourceSelectedKeys: string[], targetSelectedKeys: string[]) => {
		setSelectedKeys([...sourceSelectedKeys, ...targetSelectedKeys]);
	};

	const handleSearch: TransferProps<TransferItem>["onSearch"] = (dir, value) => {
		console.log("search:", dir, value);
	};
	/**
	* Direktes Zurückgeben des JSX für die Anzeige im Transfer-Element
	const renderItem = (item: TransferItem): React.ReactNode => {
		return (
			<>
				{item.icon && <SchemaSvgIcon svgString={item.icon} element={{}} />}
				{item.title} - {item.description}
			</>
		);
	};
	*/

	return (
		/* <CardCollapse title={langtext("general.elementchilds_assignment")}> */
		<Transfer
			dataSource={data}
			titles={[langtext("general.elementchilds_available"),langtext("general.elementchilds_assigned")]}
			targetKeys={targetKeys}
			selectedKeys={selectedKeys}
			onChange={handleChange as any}
			onSelectChange={handleSelectChange as any}
			onSearch={handleSearch}
			render={item => (
				<>
					<SchemaSvgIcon svgString={item.icon} element={{}} /> {item.title}<br/>
					{"<"}{item.baseType}{">"}
					{item.description}
				</>
			)}
			// render={renderItem}
			listStyle={{
				height: 300,
				width: "100%"
			}}
			disabled={false}
			showSelectAll={true}
			style={{width: "100%"}}
		/>
	);
});

export default ElementChildMapping;
