import React, { useMemo } from "react";
import { Checkbox, Radio, Tag } from "antd";
import { IAsset } from "../../Stores/Models/Asset.Model";
import { IDock, IDockpart } from "../../Stores/Models/Dock.Model";
import {
	dockpartDisplayLabel,
	dockpartMatchKey,
	getCompatibleDockpartsForDock,
	orderDockpartsForDisplay,
} from "../../lib/connectionDockpartPairing";
import { assetDisplayName } from "../../lib/connectionCandidateFilter";
import { resolveAssetElementType } from "../../lib/elementDefinitionTypes";

export type ConnectionEndpointSide = "from" | "to";

export type ConnectionNodeRefId =
	| "from-dock"
	| "to-dock"
	| `from-part-${string}`
	| `to-part-${string}`;

type ConnectionEndpointTreeProps = {
	side: ConnectionEndpointSide;
	asset: IAsset;
	selectedDockId: string | null;
	selectedDockpartIds: string[];
	fromMatchKeys?: Set<string>;
	onDockSelect: (dock: IDock) => void;
	onDockpartChange: (ids: string[]) => void;
	registerNodeRef: (id: ConnectionNodeRefId, element: HTMLElement | null) => void;
};

function visibleDocks(asset: IAsset, side: ConnectionEndpointSide, fromMatchKeys?: Set<string>): IDock[] {
	return asset.docks.filter((dock) => {
		if (dock.dockparts.length === 0) {
			return false;
		}
		if (side === "from") {
			return true;
		}
		if (!fromMatchKeys || fromMatchKeys.size === 0) {
			return false;
		}
		return getCompatibleDockpartsForDock(dock, fromMatchKeys).length > 0;
	});
}

function dockpartsForSide(
	dock: IDock,
	side: ConnectionEndpointSide,
	fromMatchKeys?: Set<string>
): IDockpart[] {
	if (side === "from") {
		return orderDockpartsForDisplay(dock, dock.dockparts.slice());
	}
	return orderDockpartsForDisplay(
		dock,
		getCompatibleDockpartsForDock(dock, fromMatchKeys ?? new Set())
	);
}

const ConnectionEndpointTree: React.FC<ConnectionEndpointTreeProps> = ({
	side,
	asset,
	selectedDockId,
	selectedDockpartIds,
	fromMatchKeys,
	onDockSelect,
	onDockpartChange,
	registerNodeRef,
}) => {
	const docks = useMemo(
		() => visibleDocks(asset, side, fromMatchKeys),
		[asset, side, fromMatchKeys]
	);

	const dockRefId: ConnectionNodeRefId = side === "from" ? "from-dock" : "to-dock";

	return (
		<div className="connection-selection-tree">
			<div className="connection-selection-tree__asset">
				<strong>{assetDisplayName(asset)}</strong>
				{resolveAssetElementType(asset.definition) ? (
					<Tag style={{ marginLeft: 8 }}>{resolveAssetElementType(asset.definition)}</Tag>
				) : null}
				{asset.definition?.subType ? (
					<Tag style={{ marginLeft: 4 }}>{asset.definition.subType}</Tag>
				) : null}
			</div>

			{docks.length === 0 ? (
				<div className="connection-selection-tree__empty">
					{side === "to" ? "Keine kompatiblen Docks." : "Keine Docks mit Dockparts."}
				</div>
			) : (
				docks.map((dock) => {
					const dockId = String(dock.id);
					const isSelected = selectedDockId === dockId;
					const parts = dockpartsForSide(dock, side, fromMatchKeys);

					return (
						<div
							key={dockId}
							className={
								isSelected
									? "connection-selection-tree__dock connection-selection-tree__dock--selected"
									: "connection-selection-tree__dock"
							}
							ref={(element) => {
								if (isSelected) {
									registerNodeRef(dockRefId, element);
								}
							}}
						>
							<Radio
								checked={isSelected}
								onChange={() => onDockSelect(dock)}
								className="connection-selection-tree__dock-radio"
							>
								<strong>{dock.label || dock.type || dockId}</strong>
								{dock.type ? <Tag style={{ marginLeft: 8 }}>{dock.type}</Tag> : null}
							</Radio>

							{isSelected ? (
								<Checkbox.Group
									value={selectedDockpartIds}
									onChange={(values) => onDockpartChange(values as string[])}
									className="connection-selection-tree__dockparts"
								>
									{parts.map((part) => {
										const partId = String(part.id);
										const matchKey = dockpartMatchKey(part);
										const partRefId: ConnectionNodeRefId =
											side === "from" ? `from-part-${partId}` : `to-part-${partId}`;
										return (
											<div
												key={partId}
												className="connection-selection-tree__dockpart"
												ref={(element) => registerNodeRef(partRefId, element)}
											>
												<Checkbox value={partId}>
													{dockpartDisplayLabel(part)}
													{matchKey ? (
														<Tag style={{ marginLeft: 8 }}>{matchKey}</Tag>
													) : null}
												</Checkbox>
											</div>
										);
									})}
								</Checkbox.Group>
							) : null}
						</div>
					);
				})
			)}
		</div>
	);
};

export default ConnectionEndpointTree;
