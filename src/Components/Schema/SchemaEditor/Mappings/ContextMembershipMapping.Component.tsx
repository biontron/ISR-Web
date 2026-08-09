import React from "react";
import { Button, Select, Space } from "antd";
import { observer } from "mobx-react";
import { runInAction } from "mobx";
import { IAsset } from "../../../../Stores/Models/Asset.Model";
import { rootStore } from "../../../../Stores/Root.Store";
import { assetDisplayName } from "../../../../lib/connectionCandidateFilter";
import { formatAssetDisplayName } from "../../../../lib/connectionEndpointRef";

interface ContextMembershipMappingProps {
	asset: IAsset;
	canEdit: boolean;
}

const ContextMembershipMapping: React.FC<ContextMembershipMappingProps> = ({ asset, canEdit }) => {
	const memberships = asset.contextMemberships?.slice() ?? [];
	const allAssets = rootStore.assets.assets.slice();
	const options = allAssets
		.filter((entry) => entry.id !== asset.id)
		.map((entry) => ({ value: entry.id, label: assetDisplayName(entry) }));

	const replaceMemberships = (
		next: Array<{ contextRef: string; contextLabelSnapshot?: string }>
	) => {
		if (!canEdit) {
			return;
		}
		runInAction(() => {
			asset.contextMemberships.replace(next as never[]);
		});
	};

	const addMembership = () => {
		replaceMemberships([...memberships, { contextRef: "", contextLabelSnapshot: "" }]);
	};

	const removeMembership = (index: number) => {
		replaceMemberships(memberships.filter((_, entryIndex) => entryIndex !== index));
	};

	const patchMembership = (
		index: number,
		patch: Partial<{ contextRef: string; contextLabelSnapshot?: string }>
	) => {
		replaceMemberships(
			memberships.map((entry, entryIndex) =>
				entryIndex === index ? { ...entry, ...patch } : entry
			)
		);
	};

	return (
		<section className="element-properties-section">
			<div className="element-properties-section__title">Kontext-Mitgliedschaften</div>
			<div className="element-properties-section__body">
				{memberships.length === 0 ? (
					<div className="connection-selection-tree__empty">Keine Kontext-Zuordnungen.</div>
				) : (
					memberships.map((membership, index) => (
						<div key={`context-membership-${index}`} style={{ marginBottom: 8 }}>
							<Space wrap>
								<Select
									showSearch
									allowClear
									disabled={!canEdit}
									options={options}
									value={membership.contextRef || undefined}
									placeholder="Kontext-Component"
									optionFilterProp="label"
									onChange={(contextRef) => {
										const contextAsset = allAssets.find((entry) => entry.id === contextRef);
										patchMembership(index, {
											contextRef: contextRef ?? "",
											contextLabelSnapshot: contextAsset
												? formatAssetDisplayName(contextAsset)
												: "",
										});
									}}
									style={{ minWidth: 220 }}
								/>
								{canEdit ? (
									<Button danger size="small" onClick={() => removeMembership(index)}>
										Entfernen
									</Button>
								) : null}
							</Space>
						</div>
					))
				)}
				{canEdit ? (
					<Button size="small" onClick={addMembership}>
						Kontext hinzufügen
					</Button>
				) : null}
			</div>
		</section>
	);
};

export default observer(ContextMembershipMapping);
