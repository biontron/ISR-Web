import React from "react";
import { Button, Select, Space } from "antd";
import { observer } from "mobx-react";
import { IAsset, IContextMembership } from "../../../../Stores/Models/Asset.Model";
import { IGroup } from "../../../../Stores/Models/Group.Model";
import { rootStore } from "../../../../Stores/Root.Store";
import { formatContextMembershipLabel } from "../../../../lib/effectiveDockparts";

interface ContextMembershipMappingProps {
	asset: IAsset;
	canEdit: boolean;
}

function groupDisplayName(group: IGroup): string {
	return group.definition?.label?.trim() || group.definition?.name?.trim() || group.id;
}

const ContextMembershipMapping: React.FC<ContextMembershipMappingProps> = ({ asset, canEdit }) => {
	const memberships = asset.contextMemberships?.slice() ?? [];
	const allGroups = rootStore.groups.groups.slice();
	const options = allGroups.map((group) => ({
		value: group.id,
		label: groupDisplayName(group),
	}));

	const toSnapshot = (entry: IContextMembership | { contextGroupRef: string; contextLabelSnapshot?: string }) => ({
		contextGroupRef: entry.contextGroupRef ?? "",
		contextLabelSnapshot: entry.contextLabelSnapshot ?? "",
	});

	const replaceMemberships = (
		next: Array<{ contextGroupRef: string; contextLabelSnapshot?: string }>
	) => {
		if (!canEdit) {
			return;
		}
		asset.setContextMemberships(next);
	};

	const addMembership = () => {
		replaceMemberships([...memberships.map(toSnapshot), { contextGroupRef: "", contextLabelSnapshot: "" }]);
	};

	const removeMembership = (index: number) => {
		replaceMemberships(
			memberships.filter((_entry, entryIndex) => entryIndex !== index).map(toSnapshot)
		);
	};

	const patchMembership = (
		index: number,
		patch: Partial<{ contextGroupRef: string; contextLabelSnapshot?: string }>
	) => {
		replaceMemberships(
			memberships.map((entry, entryIndex) =>
				entryIndex === index ? { ...toSnapshot(entry), ...patch } : toSnapshot(entry)
			)
		);
	};

	return (
		<section className="element-properties-section">
			<div className="element-properties-section__title">Kontext-Gruppen</div>
			<p className="element-properties-section__hint" style={{ marginBottom: 8, opacity: 0.85 }}>
				Kontext-Gruppen (VLAN, Netzwerk, …) sind keine Components. Über{" "}
				<code>valueRef</code> können einzelne Feldwerte aus der Gruppe übernommen werden —
				nicht der Protokoll-Stack (<code>basedOn</code>).
			</p>
			<div className="element-properties-section__body">
				{memberships.length === 0 ? (
					<div className="connection-selection-tree__empty">Keine Kontext-Zuordnung.</div>
				) : (
					memberships.map((membership, index) => (
						<div key={`context-membership-${index}`} style={{ marginBottom: 8 }}>
							<Space wrap>
								<Select
									showSearch
									allowClear
									disabled={!canEdit}
									options={options}
									value={membership.contextGroupRef || undefined}
									placeholder="Kontext-Gruppe (Group)"
									optionFilterProp="label"
									onChange={(contextGroupRef) => {
										const group = allGroups.find((entry) => entry.id === contextGroupRef);
										patchMembership(index, {
											contextGroupRef: contextGroupRef ?? "",
											contextLabelSnapshot: group ? groupDisplayName(group) : "",
										});
									}}
									style={{ minWidth: 240 }}
								/>
								<span style={{ opacity: 0.7 }}>
									{formatContextMembershipLabel(membership, allGroups)}
								</span>
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
						Kontext-Gruppe hinzufügen
					</Button>
				) : null}
			</div>
		</section>
	);
};

export default observer(ContextMembershipMapping);
