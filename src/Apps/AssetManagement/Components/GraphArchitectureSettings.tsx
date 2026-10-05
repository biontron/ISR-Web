import { Button, Input, Select, Table } from "antd";
import { observer } from "mobx-react";
import { useLangtext } from "../../../lib/common";
import type {
	GraphArchitectureEdge,
	GraphArchitectureRepresentation,
	GraphCellBlock,
	GraphCellRole,
	GraphLocalizedText,
	GraphRowBand,
} from "../../../lib/graphConfig";
import { graphText, presentId } from "../../../lib/graphConfig";
import { rootStore } from "../../../Stores/Root.Store";

type GraphArchitectureSettingsProps = {
	architectures: GraphArchitectureRepresentation[];
	detailArchitectures?: GraphArchitectureRepresentation[];
	canEdit: boolean;
	onChange: (next: GraphArchitectureRepresentation[]) => void;
};

function newId(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}`;
}

function editLocalized(current: unknown, lang: string, next: string): GraphLocalizedText {
	if (current && typeof current === "object" && !Array.isArray(current)) {
		return { ...(current as Record<string, string>), [lang]: next };
	}
	if (typeof current === "string" && lang && lang !== "und") {
		return { und: current, [lang]: next };
	}
	return next;
}

export const GraphArchitectureSettings = observer(function GraphArchitectureSettings({
	architectures,
	detailArchitectures,
	canEdit,
	onChange,
}: GraphArchitectureSettingsProps) {
	const langtext = useLangtext();
	const lang = rootStore.i18n.lang;
	const detailOptions = detailArchitectures ?? architectures;
	const assetOptions = rootStore.assets.assets.map((asset) => ({
		value: asset.id,
		label: asset.definition?.label || asset.definition?.name || asset.id,
	}));

	function updateArchitecture(
		architectureId: string,
		patch: Partial<GraphArchitectureRepresentation>
	) {
		onChange(
			architectures.map((entry) =>
				entry.id === architectureId ? { ...entry, ...patch } : entry
			)
		);
	}

	function updateBlock(architectureId: string, blockId: string, patch: Partial<GraphCellBlock>) {
		const architecture = architectures.find((entry) => entry.id === architectureId);
		if (!architecture) {
			return;
		}
		updateArchitecture(architectureId, {
			blocks: architecture.blocks.map((block) =>
				block.id === blockId ? { ...block, ...patch } : block
			),
		});
	}

	function addArchitecture() {
		onChange([
			...architectures,
			{
				kind: "architecture",
				id: newId("architektur"),
				label: langtext("general.graph_architecture_add"),
				blocks: [],
			},
		]);
	}

	function addBlock(architectureId: string) {
		const architecture = architectures.find((entry) => entry.id === architectureId);
		if (!architecture) {
			return;
		}
		const block: GraphCellBlock = {
			id: newId("block"),
			role: "node",
			label: langtext("general.graph_architecture_block_add"),
			range: "A1",
			elementIds: [],
			tags: [],
			fill: "#90caf9",
		};
		updateArchitecture(architectureId, { blocks: [...architecture.blocks, block] });
	}

	function removeBlock(architectureId: string, blockId: string) {
		const architecture = architectures.find((entry) => entry.id === architectureId);
		if (!architecture) {
			return;
		}
		updateArchitecture(architectureId, {
			blocks: architecture.blocks.filter((block) => block.id !== blockId),
		});
	}

	return (
		<div className="graph-architecture-wizard">
			<p>{langtext("general.graph_architecture_wizard_hint")}</p>
			{architectures.map((architecture) => (
				<section key={architecture.id} className="graph-architecture-wizard__section">
					<Input
						value={graphText(architecture.label, lang)}
						disabled={!canEdit}
						onChange={(event) =>
							updateArchitecture(architecture.id, {
								label: editLocalized(architecture.label, lang, event.target.value),
							})
						}
					/>
					<Table
						size="small"
						pagination={false}
						rowKey="id"
						dataSource={architecture.blocks}
						scroll={{ x: 1480 }}
						columns={[
							{
								title: langtext("general.graph_architecture_range"),
								dataIndex: "range",
								width: 110,
								render: (_value, block) => (
									<Input
										value={block.range}
										disabled={!canEdit}
										onChange={(event) =>
											updateBlock(architecture.id, block.id, {
												range: event.target.value,
											})
										}
									/>
								),
							},
							{
								title: "Label",
								dataIndex: "label",
								width: 180,
								render: (_value, block) => (
									<Input
										value={graphText(block.label, lang)}
										disabled={!canEdit}
										onChange={(event) =>
											updateBlock(architecture.id, block.id, {
												label: editLocalized(block.label, lang, event.target.value),
											})
										}
									/>
								),
							},
							{
								title: langtext("general.graph_architecture_role"),
								dataIndex: "role",
								width: 120,
								render: (_value, block) => (
									<Select
										value={block.role ?? "node"}
										disabled={!canEdit}
										style={{ width: "100%" }}
										options={[
											{ value: "node", label: "Box" },
											{ value: "frame", label: "Rahmen" },
											{ value: "region", label: "Fläche" },
										]}
										onChange={(role: GraphCellRole) =>
											updateBlock(architecture.id, block.id, { role })
										}
									/>
								),
							},
							{
								title: langtext("general.graph_architecture_components"),
								dataIndex: "elementIds",
								width: 260,
								render: (_value, block) => (
									<Select
										mode="multiple"
										showSearch
										optionFilterProp="label"
										value={block.elementIds ?? []}
										disabled={!canEdit || block.role === "region" || block.role === "frame"}
										style={{ width: "100%" }}
										options={assetOptions}
										onChange={(elementIds: string[]) =>
											updateBlock(architecture.id, block.id, { elementIds })
										}
									/>
								),
							},
							{
								title: langtext("general.graph_architecture_tags"),
								dataIndex: "tags",
								width: 140,
								render: (_value, block) => (
									<Input
										value={(block.tags ?? []).join(", ")}
										disabled={!canEdit}
										onChange={(event) =>
											updateBlock(architecture.id, block.id, {
												tags: event.target.value
													.split(",")
													.map((tag) => tag.trim())
													.filter(Boolean),
											})
										}
									/>
								),
							},
							{
								title: langtext("general.graph_architecture_detail"),
								dataIndex: "architectureId",
								width: 180,
								render: (_value, block) => (
									<Select
										allowClear
										value={presentId(block.architectureId)}
										disabled={!canEdit}
										style={{ width: "100%" }}
										options={detailOptions
											.filter((entry) => entry.id !== architecture.id)
											.map((entry) => ({
												value: entry.id,
												label: graphText(entry.label, lang),
											}))}
										onChange={(architectureId: string | undefined) =>
											updateBlock(architecture.id, block.id, {
												architectureId: architectureId || undefined,
											})
										}
									/>
								),
							},
							{
								title: langtext("general.graph_architecture_fill"),
								dataIndex: "fill",
								width: 110,
								render: (_value, block) => (
									<Input
										value={block.fill ?? ""}
										disabled={!canEdit}
										onChange={(event) =>
											updateBlock(architecture.id, block.id, { fill: event.target.value })
										}
									/>
								),
							},
							{
								title: langtext("general.graph_architecture_stroke"),
								dataIndex: "stroke",
								width: 110,
								render: (_value, block) => (
									<Input
										value={block.stroke ?? ""}
										disabled={!canEdit}
										onChange={(event) =>
											updateBlock(architecture.id, block.id, { stroke: event.target.value })
										}
									/>
								),
							},
							{
								title: langtext("general.graph_architecture_dash"),
								dataIndex: "strokeDasharray",
								width: 110,
								render: (_value, block) => (
									<Input
										value={block.strokeDasharray ?? ""}
										disabled={!canEdit}
										onChange={(event) =>
											updateBlock(architecture.id, block.id, {
												strokeDasharray: event.target.value,
											})
										}
									/>
								),
							},
							{
								title: langtext("general.graph_architecture_text"),
								dataIndex: "text",
								width: 160,
								render: (_value, block) => (
									<Input
										value={graphText(block.text, lang)}
										disabled={!canEdit}
										onChange={(event) =>
											updateBlock(architecture.id, block.id, {
												text: editLocalized(block.text, lang, event.target.value),
											})
										}
									/>
								),
							},
							{
								title: langtext("general.graph_architecture_text_fill"),
								dataIndex: "textFill",
								width: 110,
								render: (_value, block) => (
									<Input
										value={block.textFill ?? ""}
										disabled={!canEdit}
										onChange={(event) =>
											updateBlock(architecture.id, block.id, { textFill: event.target.value })
										}
									/>
								),
							},
							{
								title: langtext("general.graph_architecture_text_stroke"),
								dataIndex: "textStroke",
								width: 110,
								render: (_value, block) => (
									<Input
										value={block.textStroke ?? ""}
										disabled={!canEdit}
										onChange={(event) =>
											updateBlock(architecture.id, block.id, { textStroke: event.target.value })
										}
									/>
								),
							},
							{
								title: langtext("general.graph_architecture_text_dash"),
								dataIndex: "textStrokeDasharray",
								width: 110,
								render: (_value, block) => (
									<Input
										value={block.textStrokeDasharray ?? ""}
										disabled={!canEdit}
										onChange={(event) =>
											updateBlock(architecture.id, block.id, {
												textStrokeDasharray: event.target.value,
											})
										}
									/>
								),
							},
							{
								title: "",
								width: 48,
								render: (_value, block) => (
									<Button
										size="small"
										disabled={!canEdit}
										onClick={() => removeBlock(architecture.id, block.id)}
									>
										×
									</Button>
								),
							},
						]}
					/>
					<Button size="small" disabled={!canEdit} onClick={() => addBlock(architecture.id)}>
						{langtext("general.graph_architecture_block_add")}
					</Button>
					<BandEditor
						architecture={architecture}
						canEdit={canEdit}
						lang={lang}
						onChange={(rowBands) => updateArchitecture(architecture.id, { rowBands })}
					/>
					<EdgeEditor
						architecture={architecture}
						canEdit={canEdit}
						onChange={(edges) => updateArchitecture(architecture.id, { edges })}
					/>
				</section>
			))}
			<Button type="primary" size="small" disabled={!canEdit} onClick={addArchitecture}>
				{langtext("general.graph_architecture_add")}
			</Button>
		</div>
	);
});

function BandEditor({
	architecture,
	canEdit,
	lang,
	onChange,
}: {
	architecture: GraphArchitectureRepresentation;
	canEdit: boolean;
	lang: string;
	onChange: (rowBands: GraphRowBand[]) => void;
}) {
	const langtext = useLangtext();
	const rowBands = architecture.rowBands ?? [];

	function patch(index: number, next: Partial<GraphRowBand>) {
		onChange(rowBands.map((band, bandIndex) => (bandIndex === index ? { ...band, ...next } : band)));
	}

	return (
		<div className="graph-architecture-wizard__section">
			<div>{langtext("general.graph_architecture_band")}</div>
			{rowBands.map((band, index) => (
				<div className="environment-settings__row" key={`${band.range}:${index}`}>
					<Input
						value={graphText(band.label, lang)}
						disabled={!canEdit}
						onChange={(event) => patch(index, { label: editLocalized(band.label, lang, event.target.value) })}
					/>
					<Input
						value={band.range}
						disabled={!canEdit}
						onChange={(event) => patch(index, { range: event.target.value })}
					/>
					<Input
						value={band.fill ?? ""}
						disabled={!canEdit}
						placeholder={langtext("general.graph_architecture_fill")}
						onChange={(event) => patch(index, { fill: event.target.value })}
					/>
					<Input
						value={band.stroke ?? ""}
						disabled={!canEdit}
						placeholder={langtext("general.graph_architecture_stroke")}
						onChange={(event) => patch(index, { stroke: event.target.value })}
					/>
					<Input
						value={band.strokeDasharray ?? ""}
						disabled={!canEdit}
						placeholder={langtext("general.graph_architecture_dash")}
						onChange={(event) => patch(index, { strokeDasharray: event.target.value })}
					/>
					<Input
						value={band.offset ?? ""}
						disabled={!canEdit}
						placeholder={langtext("general.graph_architecture_offset")}
						onChange={(event) => {
							const offset = Number(event.target.value);
							patch(index, { offset: Number.isFinite(offset) ? offset : 0 });
						}}
					/>
					<Button
						size="small"
						disabled={!canEdit}
						onClick={() => onChange(rowBands.filter((_, bandIndex) => bandIndex !== index))}
					>
						×
					</Button>
				</div>
			))}
			<Button
				size="small"
				disabled={!canEdit}
				onClick={() => onChange([...rowBands, { label: langtext("general.graph_architecture_band"), range: "A1:A1" }])}
			>
				{langtext("general.graph_architecture_band_add")}
			</Button>
		</div>
	);
}

function EdgeEditor({
	architecture,
	canEdit,
	onChange,
}: {
	architecture: GraphArchitectureRepresentation;
	canEdit: boolean;
	onChange: (edges: GraphArchitectureEdge[]) => void;
}) {
	const langtext = useLangtext();
	const edges = architecture.edges ?? [];
	const blockOptions = architecture.blocks.map((block) => ({
		value: block.id,
		label: graphText(block.label) || block.id,
	}));

	function patch(index: number, next: Partial<GraphArchitectureEdge>) {
		onChange(edges.map((edge, edgeIndex) => (edgeIndex === index ? { ...edge, ...next } : edge)));
	}

	return (
		<div className="graph-architecture-wizard__section">
			<div>{langtext("general.graph_architecture_edge")}</div>
			{edges.map((edge, index) => (
				<div className="environment-settings__row" key={`${edge.from}:${edge.to}:${index}`}>
					<Select
						value={edge.from}
						disabled={!canEdit}
						style={{ minWidth: 140 }}
						options={blockOptions}
						onChange={(from: string) => patch(index, { from })}
					/>
					<Select
						value={edge.to}
						disabled={!canEdit}
						style={{ minWidth: 140 }}
						options={blockOptions}
						onChange={(to: string) => patch(index, { to })}
					/>
					<Input
						value={edge.lineColor ?? ""}
						disabled={!canEdit}
						placeholder={langtext("general.graph_architecture_line_color")}
						onChange={(event) => patch(index, { lineColor: event.target.value })}
					/>
					<Input
						value={edge.arrowColor ?? ""}
						disabled={!canEdit}
						placeholder={langtext("general.graph_architecture_arrow_color")}
						onChange={(event) => patch(index, { arrowColor: event.target.value })}
					/>
					<Button
						size="small"
						disabled={!canEdit}
						onClick={() => onChange(edges.filter((_, edgeIndex) => edgeIndex !== index))}
					>
						×
					</Button>
				</div>
			))}
			<Button
				size="small"
				disabled={!canEdit || architecture.blocks.length < 2}
				onClick={() =>
					onChange([
						...edges,
						{ from: architecture.blocks[0].id, to: architecture.blocks[1].id, bidirectional: false },
					])
				}
			>
				{langtext("general.graph_architecture_edge_add")}
			</Button>
		</div>
	);
}
