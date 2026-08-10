/*
	========================================================================
	LICENSE AGREEMENT — siehe Projekt-Header
	========================================================================
*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Input, Modal, Space, Tag, message } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { observer } from "mobx-react";
import { IAsset } from "../../Stores/Models/Asset.Model";
import { rootStore } from "../../Stores/Root.Store";
import { pairSelectedDockparts } from "../../lib/connectionDockpartPairing";
import {
	ConnectionCandidateFilters as CandidateFilterState,
	assetDisplayName,
	collectDistinctElementTypes,
	collectDistinctProtocols,
	collectDistinctSubTypes,
	filterConnectionCandidates,
} from "../../lib/connectionCandidateFilter";
import { resolveAssetStackAncestorChain } from "../../lib/connectionStackChain";
import {
	buildStackDraftsFromActiveMatches,
	collectWizardDockpartMatches,
	resolveActiveWizardMatches,
	wizardMatchId,
	WizardDockpartSelection,
} from "../../lib/connectionWizardMatches";
import ConnectionCandidateFiltersBar from "./ConnectionCandidateFilters";
import ConnectionWizardColumn, { ConnectionWizardNodeRefId } from "./ConnectionWizardColumn";
import ConnectionLinkOverlay from "./ConnectionLinkOverlay";
import { ConnectionDirection } from "../../lib/connectionDirection";
import { useLangtext } from "../../lib/common";

interface ConnectionSelectionDialogProps {
	visible: boolean;
	currentAsset?: IAsset | null;
	preferredFromRef?: string;
	onCancel: () => void;
	onCreated?: (connectionId: string) => void;
}

function parsePreferredFromSelection(
	preferredFromRef: string | undefined,
	currentAsset: IAsset | null | undefined
): WizardDockpartSelection[] {
	if (!preferredFromRef || !currentAsset) {
		return [];
	}
	const hashIndex = preferredFromRef.indexOf("#");
	if (hashIndex <= 0) {
		return [];
	}
	const dockId = preferredFromRef.slice(0, hashIndex);
	const dockpartId = preferredFromRef.slice(hashIndex + 1);
	const dock = currentAsset.docks.find((entry) => String(entry.id) === dockId);
	if (!dock || !dock.dockparts.some((part) => String(part.id) === dockpartId)) {
		return [];
	}
	return [{ assetId: currentAsset.id, dockId, dockpartId }];
}

function listBrowsableCandidates(allAssets: IAsset[], currentAsset: IAsset): IAsset[] {
	return allAssets.filter(
		(asset) =>
			asset.id !== currentAsset.id &&
			asset.docks.some((dock) => dock.dockparts.length > 0)
	);
}

const ConnectionSelectionDialog: React.FC<ConnectionSelectionDialogProps> = ({
	visible,
	currentAsset,
	preferredFromRef,
	onCancel,
	onCreated,
}) => {
	const langtext = useLangtext();
	const defaultLinkTitle = langtext("general.connection_new_default");
	const [linkTitle, setLinkTitle] = useState(defaultLinkTitle);
	const [definitionDescription, setDefinitionDescription] = useState("");
	const [candidateFilters, setCandidateFilters] = useState<CandidateFilterState>({});
	const [candidateIndex, setCandidateIndex] = useState(0);
	const [fromSelection, setFromSelection] = useState<WizardDockpartSelection[]>([]);
	const [toSelection, setToSelection] = useState<WizardDockpartSelection[]>([]);
	const [direction, setDirection] = useState<ConnectionDirection>("DUAL");
	const [nodeRefs] = useState(() => new Map<ConnectionWizardNodeRefId, HTMLElement>());
	const bodyRef = useRef<HTMLDivElement>(null);

	const allAssets = rootStore.assets.assets.slice();
	const allGroups = rootStore.groups.groups.slice();

	const registerNodeRef = useCallback(
		(id: ConnectionWizardNodeRefId, element: HTMLElement | null) => {
			if (element) {
				nodeRefs.set(id, element);
			} else {
				nodeRefs.delete(id);
			}
		},
		[nodeRefs]
	);

	const fromStack = useMemo(() => {
		if (!currentAsset) {
			return [];
		}
		const chain = resolveAssetStackAncestorChain(currentAsset.id, allAssets);
		return chain.length > 0 ? chain : [currentAsset];
	}, [currentAsset, allAssets]);

	const browseCandidates = useMemo(() => {
		if (!currentAsset) {
			return [];
		}
		return filterConnectionCandidates(
			listBrowsableCandidates(allAssets, currentAsset),
			candidateFilters
		);
	}, [allAssets, currentAsset, candidateFilters]);

	const elementTypeOptions = useMemo(
		() => collectDistinctElementTypes(browseCandidates),
		[browseCandidates]
	);
	const subTypeOptions = useMemo(
		() => collectDistinctSubTypes(browseCandidates, candidateFilters.elementType),
		[browseCandidates, candidateFilters.elementType]
	);
	const protocolOptions = useMemo(
		() => collectDistinctProtocols(browseCandidates),
		[browseCandidates]
	);

	const toAsset = useMemo(() => {
		if (browseCandidates.length === 0) {
			return undefined;
		}
		const index = Math.min(candidateIndex, browseCandidates.length - 1);
		return browseCandidates[index];
	}, [browseCandidates, candidateIndex]);

	const toStack = useMemo(() => {
		if (!toAsset) {
			return [];
		}
		const chain = resolveAssetStackAncestorChain(toAsset.id, allAssets);
		return chain.length > 0 ? chain : [toAsset];
	}, [toAsset, allAssets]);

	const wizardMatches = useMemo(
		() => collectWizardDockpartMatches(fromStack, toStack, allAssets, allGroups),
		[fromStack, toStack, allAssets, allGroups]
	);

	const activeMatches = useMemo(
		() => resolveActiveWizardMatches(wizardMatches, fromSelection, toSelection),
		[wizardMatches, fromSelection, toSelection]
	);

	const activeMatchIds = useMemo(
		() => new Set(activeMatches.map((match) => wizardMatchId(match))),
		[activeMatches]
	);

	const highlightMatchKeys = useMemo(() => {
		const keys = new Set<string>();
		for (const match of wizardMatches) {
			keys.add(match.matchKey);
		}
		return keys;
	}, [wizardMatches]);

	useEffect(() => {
		if (browseCandidates.length === 0) {
			setToSelection([]);
			return;
		}
		if (candidateIndex >= browseCandidates.length) {
			setCandidateIndex(0);
		}
	}, [browseCandidates.length, candidateIndex]);

	const resetState = () => {
		setLinkTitle(defaultLinkTitle);
		setDefinitionDescription("");
		setCandidateFilters({});
		setCandidateIndex(0);
		setFromSelection([]);
		setToSelection([]);
		setDirection("DUAL");
		nodeRefs.clear();
	};

	const handleCancel = () => {
		resetState();
		onCancel();
	};

	const handleConnect = () => {
		if (!currentAsset || !toAsset || activeMatches.length === 0) {
			return;
		}

		const drafts = buildStackDraftsFromActiveMatches(activeMatches);
		if (drafts.length === 0) {
			message.error("Keine aktiven Pairings ausgewählt.");
			return;
		}

		for (const draft of drafts) {
			const fromDock = allAssets
				.find((asset) => asset.id === draft.fromAssetId)
				?.docks.find((dock) => String(dock.id) === draft.fromDockId);
			const toDock = allAssets
				.find((asset) => asset.id === draft.toAssetId)
				?.docks.find((dock) => String(dock.id) === draft.toDockId);
			if (!fromDock || !toDock) {
				message.error("Dock für ausgewähltes Pairing konnte nicht aufgelöst werden.");
				return;
			}
			const pairingPreview = pairSelectedDockparts(
				fromDock,
				draft.fromDockpartIds,
				toDock,
				draft.toDockpartIds,
				{
					fromAsset: allAssets.find((asset) => asset.id === draft.fromAssetId),
					toAsset: allAssets.find((asset) => asset.id === draft.toAssetId),
					allAssets,
				}
			);
			if (pairingPreview.linkparts.length === 0) {
				message.error("Keine passenden Dockpart-Paare gefunden.");
				return;
			}
		}

		try {
			const trimmedTitle = linkTitle.trim();
			const connection = rootStore.connections.createFromStackDrafts({
				drafts,
				linkTitle: trimmedTitle || undefined,
				definitionLabel: trimmedTitle || undefined,
				definitionDescription: definitionDescription.trim() || undefined,
				direction,
			});
			const linkCount = connection.links.length;
			message.success(
				linkCount === 1
					? "Connection erstellt"
					: `Connection mit ${linkCount} Links erstellt`
			);
			onCreated?.(connection.id);
			resetState();
			onCancel();
		} catch (error) {
			message.error(error instanceof Error ? error.message : "Connection konnte nicht erstellt werden.");
		}
	};

	const shiftCandidate = (delta: number) => {
		if (browseCandidates.length === 0) {
			return;
		}
		setCandidateIndex((index) => {
			const next = index + delta;
			if (next < 0) {
				return browseCandidates.length - 1;
			}
			if (next >= browseCandidates.length) {
				return 0;
			}
			return next;
		});
		setToSelection([]);
	};

	const layoutKey = `${fromSelection.map((entry) => `${entry.assetId}:${entry.dockpartId}`).join(",")}-${toSelection.map((entry) => `${entry.assetId}:${entry.dockpartId}`).join(",")}-${wizardMatches.length}-${candidateIndex}`;
	const canConnect = activeMatches.length > 0;

	const rightPager = (
		<div className="connection-wizard-column__pager">
			<Button
				size="small"
				icon={<LeftOutlined />}
				disabled={browseCandidates.length <= 1}
				onClick={() => shiftCandidate(-1)}
			/>
			<span>
				{browseCandidates.length === 0
					? "0 / 0"
					: `${candidateIndex + 1} / ${browseCandidates.length}`}
			</span>
			<Button
				size="small"
				icon={<RightOutlined />}
				disabled={browseCandidates.length <= 1}
				onClick={() => shiftCandidate(1)}
			/>
		</div>
	);

	return (
		<Modal
			title="Verbindung anlegen"
			open={visible}
			onCancel={handleCancel}
			width={1180}
			className="connection-selection-dialog"
			footer={
				<Space>
					<Button onClick={handleCancel}>Abbrechen</Button>
					<Button type="primary" disabled={!canConnect} onClick={handleConnect}>
						Verbinden
					</Button>
				</Space>
			}
			afterOpenChange={(open) => {
				if (!open || !currentAsset) {
					return;
				}
				setLinkTitle(defaultLinkTitle);
				const preferred = parsePreferredFromSelection(preferredFromRef, currentAsset);
				if (preferred.length > 0) {
					setFromSelection(preferred);
				}
			}}
		>
			<div className="connection-selection-dialog__meta">
				<Input
					placeholder="Titel / Label der Verbindung"
					value={linkTitle}
					onChange={(event) => setLinkTitle(event.target.value)}
				/>
				<Input.TextArea
					placeholder="Beschreibung (optional)"
					value={definitionDescription}
					onChange={(event) => setDefinitionDescription(event.target.value)}
					autoSize={{ minRows: 1, maxRows: 3 }}
					style={{ marginTop: 8 }}
				/>
			</div>

			<ConnectionCandidateFiltersBar
				filters={candidateFilters}
				elementTypeOptions={elementTypeOptions}
				subTypeOptions={subTypeOptions}
				protocolOptions={protocolOptions}
				onChange={(next) => {
					setCandidateFilters(next);
					setCandidateIndex(0);
					setToSelection([]);
				}}
			/>

			<div className="connection-selection-dialog__headers">
				<div className="connection-selection-dialog__header-side">
					<strong>Von</strong>
					{currentAsset ? (
						<Tag style={{ marginLeft: 8 }}>{assetDisplayName(currentAsset)}</Tag>
					) : null}
					{fromStack.length > 1 ? (
						<Tag style={{ marginLeft: 4 }}>Stapel · {fromStack.length}</Tag>
					) : null}
				</div>
				<div className="connection-selection-dialog__header-side connection-selection-dialog__header-side--to">
					<strong>Nach</strong>
					{toAsset ? (
						<Tag style={{ marginLeft: 8 }}>{assetDisplayName(toAsset)}</Tag>
					) : (
						<span style={{ marginLeft: 8, opacity: 0.65 }}>Kandidat wählen</span>
					)}
					{toStack.length > 1 ? (
						<Tag style={{ marginLeft: 4 }}>Stapel · {toStack.length}</Tag>
					) : null}
					{rightPager}
				</div>
			</div>

			<div className="connection-selection-dialog__body" ref={bodyRef}>
				<div className="connection-selection-dialog__column">
					{currentAsset ? (
						<ConnectionWizardColumn
							side="from"
							assets={fromStack}
							allAssets={allAssets}
							allGroups={allGroups}
							selection={fromSelection}
							onSelectionChange={setFromSelection}
							registerNodeRef={registerNodeRef}
							highlightMatchKeys={highlightMatchKeys}
						/>
					) : null}
				</div>

				<ConnectionLinkOverlay
					containerRef={bodyRef}
					nodeRefs={nodeRefs}
					matches={wizardMatches}
					activeMatchIds={activeMatchIds}
					direction={direction}
					onDirectionChange={setDirection}
					layoutKey={layoutKey}
				/>

				<div className="connection-selection-dialog__column">
					{toAsset ? (
						<ConnectionWizardColumn
							side="to"
							assets={toStack}
							allAssets={allAssets}
							allGroups={allGroups}
							selection={toSelection}
							onSelectionChange={setToSelection}
							registerNodeRef={registerNodeRef}
							highlightMatchKeys={highlightMatchKeys}
							headerExtra={null}
						/>
					) : (
						<div className="connection-selection-tree__empty">
							{browseCandidates.length === 0
								? "Keine Kandidaten für die Filter."
								: "Kein Kandidat ausgewählt."}
						</div>
					)}
				</div>
			</div>

			{wizardMatches.length > 0 ? (
				<Alert
					type="info"
					showIcon
					style={{ marginTop: 12 }}
					message={`${wizardMatches.length} mögliche Pairing(s) · ${activeMatches.length} aktiv ausgewählt`}
				/>
			) : toAsset ? (
				<Alert
					type="warning"
					showIcon
					style={{ marginTop: 12 }}
					message="Keine protokollgleichen Dockparts zwischen Von und Nach gefunden."
				/>
			) : null}
		</Modal>
	);
};

export default observer(ConnectionSelectionDialog);
