import React, { useCallback, useMemo, useRef, useState } from "react";
import { Button, Modal, Space, Table } from "antd";
import type { ColumnsType } from "antd/es/table/interface";
import { observer } from "mobx-react";
import { rootStore } from "../../../Stores/Root.Store";
import { iacTemplateSelectionKey } from "../../../lib/iacTemplateKeys";

type TemplateTableRow = {
	key: string;
	rowType: "package" | "template";
	packageName: string;
	templateName?: string;
	name: string;
	children?: TemplateTableRow[];
};

const TemplateStore: React.FC = observer(() => {
	const { packages, selectedPackageName, selectedTemplateName } = rootStore.iac;
	const { isReadOnly } = rootStore.ui;
	const [expandedPackageKeys, setExpandedPackageKeys] = useState<string[]>([]);
	const [loadedPackages, setLoadedPackages] = useState<Set<string>>(new Set());
	const [uploadPackageName, setUploadPackageName] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const templateListKey = packages
		.map((pkg) => `${pkg.name}:${rootStore.iac.getTemplatesForPackage(pkg.name).length}`)
		.join("|");

	const tableData = useMemo((): TemplateTableRow[] => {
		return packages.map((pkg) => {
			const templates = rootStore.iac.getTemplatesForPackage(pkg.name);
			return {
				key: `pkg:${pkg.name}`,
				rowType: "package",
				packageName: pkg.name,
				name: pkg.name,
				children: templates.map((template) => ({
					key: iacTemplateSelectionKey(pkg.name, template.name),
					rowType: "template" as const,
					packageName: pkg.name,
					templateName: template.name,
					name: template.name,
				})),
			};
		});
	}, [packages, templateListKey]);

	const onExpand = useCallback(
		async (expanded: boolean, record: TemplateTableRow) => {
			if (record.rowType !== "package") {
				return;
			}
			if (expanded) {
				setExpandedPackageKeys((prev) => Array.from(new Set([...prev, record.key])));
				if (!loadedPackages.has(record.packageName)) {
					await rootStore.iac.loadTemplatesForPackage(record.packageName);
					setLoadedPackages((prev) => new Set(prev).add(record.packageName));
				}
			} else {
				setExpandedPackageKeys((prev) => prev.filter((key) => key !== record.key));
			}
		},
		[loadedPackages]
	);

	const handleUploadClick = (packageName: string) => {
		setUploadPackageName(packageName);
		fileInputRef.current?.click();
	};

	const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file || !uploadPackageName) {
			return;
		}
		const xmlText = await file.text();
		await rootStore.iac.uploadTemplate(uploadPackageName, xmlText);
		setLoadedPackages((prev) => new Set(prev).add(uploadPackageName));
		setExpandedPackageKeys((prev) => Array.from(new Set([...prev, `pkg:${uploadPackageName}`])));
		setUploadPackageName(null);
	};

	const handleDownload = (record: TemplateTableRow) => {
		if (!record.templateName) {
			return;
		}
		rootStore.iac.setSelectedTemplateKeys([record.key]);
		void rootStore.iac.downloadSelectedTemplates();
	};

	const handleDelete = (record: TemplateTableRow) => {
		if (!record.templateName) {
			return;
		}
		Modal.confirm({
			title: "Template löschen?",
			content: `„${record.templateName}“ wirklich löschen?`,
			okText: "Löschen",
			okType: "danger",
			cancelText: "Abbrechen",
			onOk: async () => {
				rootStore.iac.setSelectedTemplateKeys([record.key]);
				await rootStore.iac.deleteSelectedTemplates();
			},
		});
	};

	const columns: ColumnsType<TemplateTableRow> = [
		{
			title: "Name",
			dataIndex: "name",
			key: "name",
			render: (value, record) => (
				<span className={record.rowType === "package" ? "iac-row-package" : undefined}>{value}</span>
			),
		},
		{
			title: "Aktion",
			key: "action",
			width: 200,
			render: (_, record) => {
				if (record.rowType === "package") {
					return (
						<Button
							size="small"
							disabled={isReadOnly}
							onClick={(event) => {
								event.stopPropagation();
								handleUploadClick(record.packageName);
							}}
						>
							Upload
						</Button>
					);
				}
				return (
					<Space size="small" onClick={(event) => event.stopPropagation()}>
						<Button size="small" onClick={() => handleDownload(record)}>
							Download
						</Button>
						<Button
							size="small"
							danger
							disabled={isReadOnly}
							onClick={() => handleDelete(record)}
						>
							Delete
						</Button>
					</Space>
				);
			},
		},
	];

	return (
		<div>
			<input
				ref={fileInputRef}
				type="file"
				accept=".xml,application/xml,text/xml"
				style={{ display: "none" }}
				onChange={(event) => void handleFileSelected(event)}
			/>
			{packages.length === 0 && <p style={{ padding: 8 }}>Keine Packages geladen.</p>}
			<Table<TemplateTableRow>
				className="iac-template-store-table"
				size="small"
				pagination={false}
				columns={columns}
				dataSource={tableData}
				expandable={{
					expandedRowKeys: expandedPackageKeys,
					onExpand,
				}}
				onRow={(record) => ({
					onClick: () => {
						if (record.rowType === "template" && record.templateName) {
							void rootStore.iac.selectTemplate(record.packageName, record.templateName);
						}
					},
					style: {
						cursor: record.rowType === "template" ? "pointer" : "default",
						fontWeight:
							record.rowType === "template" &&
							record.packageName === selectedPackageName &&
							record.templateName === selectedTemplateName
								? 600
								: undefined,
					},
				})}
			/>
		</div>
	);
});

export default TemplateStore;
