import React, { useMemo } from "react";
import { Checkbox, Tag } from "antd";
import { IAsset } from "../../Stores/Models/Asset.Model";
import { IDock, IDockpart } from "../../Stores/Models/Dock.Model";
import {
	dockpartDisplayLabel,
	dockpartMatchKey,
	orderDockpartsForDisplay,
} from "../../lib/connectionDockpartPairing";
import { assetDisplayName } from "../../lib/connectionCandidateFilter";
import { resolveAssetElementType } from "../../lib/elementDefinitionTypes";
import {
	formatEffectiveDockpartLabel,
	getEffectiveDocks,
	isInheritedDockpart,
} from "../../lib/effectiveDockparts";
import {
	DockpartLocator,
	WizardDockpartSelection,
	dockpartLocatorKey,
	isDockpartSelected,
	toggleDockpartSelection,
} from "../../lib/connectionWizardMatches";

export type ConnectionWizardNodeRefId =
	| `from-part-${string}`
	| `to-part-${string}`;

export function buildWizardNodeRefId(
	side: "from" | "to",
	locator: DockpartLocator
): ConnectionWizardNodeRefId {
	return `${side}-part-${dockpartLocatorKey(locator)}`;
}

type ConnectionWizardColumnProps = {
	side: "from" | "to";
	assets: IAsset[];
	allAssets: IAsset[];
	selection: WizardDockpartSelection[];
	onSelectionChange: (next: WizardDockpartSelection[]) => void;
	registerNodeRef: (id: ConnectionWizardNodeRefId, element: HTMLElement | null) => void;
	highlightMatchKeys?: Set<string>;
	headerExtra?: React.ReactNode;
};

const ConnectionWizardColumn: React.FC<ConnectionWizardColumnProps> = ({
	side,
	assets,
	allAssets,
	selection,
	onSelectionChange,
	registerNodeRef,
	highlightMatchKeys,
	headerExtra,
}) => {
	const visibleAssets = useMemo(
		() =>
			assets.filter((asset) =>
				getEffectiveDocks(asset, allAssets).some((dock) => dock.dockparts.length > 0)
			),
		[assets, allAssets]
	);

	return (
		<div className="connection-wizard-column">
			{headerExtra ? <div className="connection-wizard-column__header-extra">{headerExtra}</div> : null}

			{visibleAssets.length === 0 ? (
				<div className="connection-selection-tree__empty">Keine Docks mit Dockparts.</div>
			) : (
				visibleAssets.map((asset, assetIndex) => (
					<div key={asset.id} className="connection-wizard-column__asset-block">
						{visibleAssets.length > 1 ? (
							<div className="connection-wizard-column__stack-label">
								{assetIndex === 0 ? "Stapel" : null}
							</div>
						) : null}
						<div className="connection-selection-tree__asset">
							<strong>{assetDisplayName(asset)}</strong>
							{resolveAssetElementType(asset.definition) ? (
								<Tag style={{ marginLeft: 8 }}>{resolveAssetElementType(asset.definition)}</Tag>
							) : null}
							{asset.definition?.subType ? (
								<Tag style={{ marginLeft: 4 }}>{asset.definition.subType}</Tag>
							) : null}
						</div>

						{getEffectiveDocks(asset, allAssets)
							.filter((dock) => dock.dockparts.length > 0)
							.map((dock) => {
								const dockId = String(dock.id);
								const parts = orderDockpartsForDisplay(
									dock as IDock,
									dock.dockparts.slice() as IDockpart[]
								);
								return (
									<div key={`${asset.id}-${dockId}`} className="connection-selection-tree__dock">
										<div className="connection-selection-tree__dock-title">
											<strong>{dock.label || dock.type || dockId}</strong>
											{dock.type ? <Tag style={{ marginLeft: 8 }}>{dock.type}</Tag> : null}
										</div>
										<div className="connection-selection-tree__dockparts">
											{parts.map((part) => {
												const partId = String(part.id);
												const locator: DockpartLocator = {
													assetId: asset.id,
													dockId,
													dockpartId: partId,
												};
												const matchKey = dockpartMatchKey(part);
												const checked = isDockpartSelected(selection, locator);
												const refId = buildWizardNodeRefId(side, locator);
												const highlighted = !!matchKey && highlightMatchKeys?.has(matchKey);
												const inherited = isInheritedDockpart(part);
												return (
													<div
														key={refId}
														className={
															highlighted
																? "connection-selection-tree__dockpart connection-selection-tree__dockpart--match"
																: inherited
																	? "connection-selection-tree__dockpart connection-selection-tree__dockpart--inherited"
																	: "connection-selection-tree__dockpart"
														}
														ref={(element) => registerNodeRef(refId, element)}
													>
														<Checkbox
															checked={checked}
															onChange={(event) =>
																onSelectionChange(
																	toggleDockpartSelection(
																		selection,
																		locator,
																		event.target.checked
																	)
																)
															}
														>
															{inherited
																? formatEffectiveDockpartLabel(part)
																: dockpartDisplayLabel(part)}
															{matchKey ? (
																<Tag style={{ marginLeft: 8 }}>{matchKey}</Tag>
															) : null}
														</Checkbox>
													</div>
												);
											})}
										</div>
									</div>
								);
							})}
					</div>
				))
			)}
		</div>
	);
};

export default ConnectionWizardColumn;
