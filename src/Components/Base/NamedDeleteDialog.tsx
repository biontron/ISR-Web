/*
# SPDX-License-Identifier: GPL-2.0
*/
import React, { useEffect, useState } from "react";
import { Input, Modal, Select } from "antd";
import { useLangtext } from "../../lib/common";

export type NamedDeleteTarget = {
	id: string;
	name: string;
};

type NamedDeleteKind = "view" | "environment";

interface NamedDeleteDialogProps {
	open: boolean;
	kind: NamedDeleteKind;
	targets: NamedDeleteTarget[];
	initialId?: string;
	onCancel: () => void;
	onConfirm: (id: string) => void;
}

function namesMatch(expected: string, typed: string): boolean {
	return expected.trim() === typed.trim();
}

const NamedDeleteDialog: React.FC<NamedDeleteDialogProps> = ({
	open,
	kind,
	targets,
	initialId,
	onCancel,
	onConfirm,
}) => {
	const langtext = useLangtext();
	const [step, setStep] = useState<"select" | "confirm">("select");
	const [selectedId, setSelectedId] = useState("");
	const [typedName, setTypedName] = useState("");

	useEffect(() => {
		if (!open) {
			return;
		}
		const fallback = targets[0]?.id ?? "";
		const nextId = targets.some((target) => target.id === initialId) ? initialId ?? fallback : fallback;
		setStep(targets.length === 1 ? "confirm" : "select");
		setSelectedId(nextId);
		setTypedName("");
	}, [open, initialId, targets]);

	const selected = targets.find((target) => target.id === selectedId);
	const canDelete = !!selected && namesMatch(selected.name, typedName);

	const title =
		step === "select"
			? langtext(kind === "view" ? "general.delete_select_view" : "general.delete_select_environment")
			: langtext(kind === "view" ? "general.delete_confirm_view_title" : "general.delete_confirm_environment_title");

	const warning = (
		kind === "view"
			? langtext("general.delete_confirm_warning_view")
			: langtext("general.delete_confirm_warning_environment")
	).replace("@@name@@", selected?.name ?? "");

	return (
		<Modal
			open={open}
			title={title}
			okText={
				step === "select" ? langtext("general.continue") : langtext("general.delete")
			}
			cancelText={langtext("general.cancel")}
			okButtonProps={{
				danger: step === "confirm",
				disabled: step === "select" ? !selected : !canDelete,
			}}
			onCancel={onCancel}
			onOk={() => {
				if (step === "select") {
					if (!selected) {
						return;
					}
					setTypedName("");
					setStep("confirm");
					return;
				}
				if (!selected || !canDelete) {
					return;
				}
				onConfirm(selected.id);
			}}
			destroyOnClose
		>
			{step === "select" ? (
				<Select
					style={{ width: "100%" }}
					value={selectedId || undefined}
					placeholder={title}
					onChange={(value) => setSelectedId(value)}
					options={targets.map((target) => ({
						value: target.id,
						label: target.name,
					}))}
				/>
			) : (
				<>
					<p>{warning}</p>
					<label style={{ display: "block", marginBottom: 8 }}>
						{langtext("general.delete_confirm_type_name")}
					</label>
					<Input
						autoFocus
						value={typedName}
						placeholder={selected?.name}
						onChange={(event) => setTypedName(event.target.value)}
						onPressEnter={() => {
							if (selected && canDelete) {
								onConfirm(selected.id);
							}
						}}
					/>
				</>
			)}
		</Modal>
	);
};

export default NamedDeleteDialog;
