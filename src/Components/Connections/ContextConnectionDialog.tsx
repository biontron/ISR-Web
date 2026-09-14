import React, { useMemo, useState } from "react";
import { Button, Input, Modal, Select, Space, message } from "antd";
import { observer } from "mobx-react";
import { IAsset } from "../../Stores/Models/Asset.Model";
import { rootStore } from "../../Stores/Root.Store";
import { assetDisplayName } from "../../lib/connectionCandidateFilter";
import { collectContextValues, matchingContextValuesForDockpart } from "../../lib/connectionContextValues";
import { collectContextComponents } from "../../lib/connectionDevice";
import { useLangtext } from "../../lib/common";

interface ContextConnectionDialogProps {
	visible: boolean;
	fromAsset: IAsset;
	preferredContextId?: string;
	preferredDockpartId?: string;
	onCancel: () => void;
	onCreated?: (connectionId: string) => void;
}

const ContextConnectionDialog: React.FC<ContextConnectionDialogProps> = ({
	visible,
	fromAsset,
	preferredContextId,
	preferredDockpartId,
	onCancel,
	onCreated,
}) => {
	const langtext = useLangtext();
	const allAssets = rootStore.assets.assets.slice();
	const dockpartOptions = useMemo(
		() =>
			fromAsset.docks.flatMap((dock) =>
				dock.dockparts.map((part) => ({
					value: `${dock.id}#${part.id}`,
					label: `${part.label || part.type || part.id} (${dock.label || dock.id})`,
					dockId: String(dock.id),
					dockpartId: String(part.id),
					part,
				}))
			),
		[fromAsset]
	);
	const [dockKey, setDockKey] = useState<string | undefined>(
		preferredDockpartId
			? dockpartOptions.find((entry) => entry.dockpartId === preferredDockpartId)?.value
			: dockpartOptions[0]?.value
	);
	const [contextId, setContextId] = useState<string | undefined>(preferredContextId);
	const [valueId, setValueId] = useState<string | undefined>();
	const [title, setTitle] = useState("");

	const contextComponents = collectContextComponents(allAssets).filter(
		(asset) => asset.id !== fromAsset.id
	);
	const selectedPart = dockpartOptions.find((entry) => entry.value === dockKey);
	const selectedContext = contextComponents.find((asset) => asset.id === contextId);
	const valueOptions = selectedContext && selectedPart
		? matchingContextValuesForDockpart([selectedContext], selectedPart.part)
		: selectedContext
			? collectContextValues(selectedContext)
			: [];

	const reset = () => {
		setDockKey(dockpartOptions[0]?.value);
		setContextId(preferredContextId);
		setValueId(undefined);
		setTitle("");
	};

	const handleCreate = () => {
		if (!selectedPart || !contextId || !valueId) {
			return;
		}
		try {
			const connection = rootStore.connections.createContextConnection({
				fromAssetId: fromAsset.id,
				toContextId: contextId,
				fromDockId: selectedPart.dockId,
				fromDockpartId: selectedPart.dockpartId,
				contextValueId: valueId,
				title: title.trim() || undefined,
				definitionLabel: title.trim() || undefined,
			});
			message.success(langtext("general.connection_context_created"));
			onCreated?.(connection.id);
			reset();
			onCancel();
		} catch (error) {
			message.error(error instanceof Error ? error.message : langtext("general.connection_create_failed"));
		}
	};

	return (
		<Modal
			title={langtext("general.connection_context_add")}
			open={visible}
			onCancel={() => {
				reset();
				onCancel();
			}}
			footer={
				<Space>
					<Button onClick={onCancel}>{langtext("general.cancel")}</Button>
					<Button type="primary" disabled={!selectedPart || !contextId || !valueId} onClick={handleCreate}>
						{langtext("general.create")}
					</Button>
				</Space>
			}
		>
			<Space direction="vertical" style={{ width: "100%" }} size="middle">
				<div>
					<strong>{langtext("general.connection_overview_col_from")}:</strong> {assetDisplayName(fromAsset)}
				</div>
				<Select
					placeholder={langtext("general.connection_context_dockpart")}
					style={{ width: "100%" }}
					value={dockKey}
					onChange={setDockKey}
					options={dockpartOptions}
				/>
				<Select
					showSearch
					placeholder={langtext("general.connection_context_component")}
					style={{ width: "100%" }}
					value={contextId}
					onChange={(value) => {
						setContextId(value);
						setValueId(undefined);
					}}
					options={contextComponents.map((asset) => ({
						value: asset.id,
						label: assetDisplayName(asset),
					}))}
					optionFilterProp="label"
				/>
				<Select
					placeholder={langtext("general.connection_context_value")}
					style={{ width: "100%" }}
					value={valueId}
					onChange={setValueId}
					options={valueOptions.map((value) => ({
						value: value.valueId,
						label: value.label,
					}))}
					disabled={!contextId}
				/>
				<Input
					placeholder={langtext("general.connection_title_optional")}
					value={title}
					onChange={(event) => setTitle(event.target.value)}
				/>
			</Space>
		</Modal>
	);
};

export default observer(ContextConnectionDialog);
