import React from "react";
import { Button, Input, Select, Space } from "antd";
import { observer } from "mobx-react";
import { runInAction } from "mobx";
import { IAsset } from "../../../Stores/Models/Asset.Model";
import { IDockpart } from "../../../Stores/Models/Dock.Model";
import { rootStore } from "../../../Stores/Root.Store";
import { assetDisplayName } from "../../../lib/connectionCandidateFilter";
import { formatAssetDisplayName } from "../../../lib/connectionEndpointRef";

type BasedOnEntrySnapshot = {
	dockpartId?: string | number;
	componentRef?: string;
	externalDockpartRef?: string;
};

interface SchemaEditorDockpartBasedOnProps {
	dockpart: IDockpart;
	asset: IAsset;
	canEdit: boolean;
}

function readEntries(dockpart: IDockpart): BasedOnEntrySnapshot[] {
	return (dockpart.basedOn ?? []).map((entry) => ({
		dockpartId: entry.dockpartId,
		componentRef: (entry as BasedOnEntrySnapshot).componentRef,
		externalDockpartRef: (entry as BasedOnEntrySnapshot).externalDockpartRef,
	}));
}

const SchemaEditorDockpartBasedOn: React.FC<SchemaEditorDockpartBasedOnProps> = ({
	dockpart,
	asset,
	canEdit,
}) => {
	const allAssets = rootStore.assets.assets.slice();
	const componentOptions = allAssets
		.filter((entry) => entry.id !== asset.id)
		.map((entry) => ({
			value: entry.id,
			label: assetDisplayName(entry),
		}));

	const entries = readEntries(dockpart);

	const updateEntries = (next: BasedOnEntrySnapshot[]) => {
		if (!canEdit) {
			return;
		}
		runInAction(() => {
			dockpart.basedOn.replace(
				next.map((entry) => ({
					dockpartId: entry.dockpartId ?? "",
					componentRef: entry.componentRef ?? "",
					externalDockpartRef: entry.externalDockpartRef ?? "",
				})) as never[]
			);
		});
	};

	const addEntry = () => {
		updateEntries([...entries, {}]);
	};

	const removeEntry = (index: number) => {
		updateEntries(entries.filter((_, entryIndex) => entryIndex !== index));
	};

	const patchEntry = (index: number, patch: Partial<BasedOnEntrySnapshot>) => {
		updateEntries(entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)));
	};

	return (
		<div className="schema-dockpart-basedon">
			<strong>basedOn</strong>
			{entries.length === 0 ? (
				<div className="schema-dockpart-basedon__empty">Keine Stack-Referenzen.</div>
			) : (
				entries.map((entry, index) => (
					<div key={`based-on-${index}`} className="schema-dockpart-basedon__row">
						<Space wrap>
							<Input
								placeholder="dockpartId (lokal)"
								value={entry.dockpartId != null ? String(entry.dockpartId) : ""}
								disabled={!canEdit}
								onChange={(event) =>
									patchEntry(index, { dockpartId: event.target.value || undefined })
								}
								style={{ width: 140 }}
							/>
							<Select
								allowClear
								showSearch
								placeholder="Component"
								options={componentOptions}
								value={entry.componentRef || undefined}
								disabled={!canEdit}
								onChange={(value) =>
									patchEntry(index, {
										componentRef: value,
										...(value
											? {
													externalDockpartRef: undefined,
												}
											: {}),
									})
								}
								style={{ minWidth: 180 }}
								optionFilterProp="label"
							/>
							<Input
								placeholder="external dockId#dockpartId"
								value={entry.externalDockpartRef ?? ""}
								disabled={!canEdit}
								onChange={(event) =>
									patchEntry(index, {
										externalDockpartRef: event.target.value || undefined,
										componentRef: event.target.value ? entry.componentRef : entry.componentRef,
									})
								}
								style={{ width: 220 }}
							/>
							{canEdit ? (
								<Button danger size="small" onClick={() => removeEntry(index)}>
									Entfernen
								</Button>
							) : null}
						</Space>
						{entry.componentRef ? (
							<div className="schema-dockpart-basedon__hint">
								Component: {formatAssetDisplayName(
									allAssets.find((item) => item.id === entry.componentRef)
								)}
							</div>
						) : null}
					</div>
				))
			)}
			{canEdit ? (
				<Button size="small" style={{ marginTop: 8 }} onClick={addEntry}>
					Referenz hinzufügen
				</Button>
			) : null}
		</div>
	);
};

export default observer(SchemaEditorDockpartBasedOn);
