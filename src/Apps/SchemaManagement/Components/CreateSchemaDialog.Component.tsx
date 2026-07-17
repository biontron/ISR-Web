/*
	========================================================================
	LICENSE AGREEMENT — siehe andere App-Dateien
	========================================================================
*/

import React, { useState } from "react";
import { Form, Input, Modal, message } from "antd";
import { observer } from "mobx-react";
import authStore from "../../../Stores/Auth.Store";
import { rootStore } from "../../../Stores/Root.Store";
import { ConnectSchemaModel } from "../../../Stores/Models/ConnectSchema.Model";
import { SchemaModel } from "../../../Stores/Models/Schema.Model";
import { useLangtext } from "../../../lib/common";
import { SchemaBaseType } from "../../../lib/schemaDomain";
import { createEmptySchemaPayload } from "../../../lib/schemaCreateDefaults";

interface CreateSchemaDialogProps {
	open: boolean;
	baseType: SchemaBaseType;
	onClose: () => void;
	onCreated: (schemaId: string) => void;
}

const CreateSchemaDialog: React.FC<CreateSchemaDialogProps> = observer(
	({ open, baseType, onClose, onCreated }) => {
		const langtext = useLangtext();
		const [schemaId, setSchemaId] = useState("");
		const [submitting, setSubmitting] = useState(false);

		const handleSubmit = async () => {
			const trimmed = schemaId.trim();
			if (!trimmed) {
				message.warning(langtext("general.schema_create_id_required"));
				return;
			}
			if (rootStore.configSchemas.getSchema(baseType, trimmed)) {
				message.error(langtext("general.schema_create_id_exists"));
				return;
			}

			setSubmitting(true);
			try {
				const payload = createEmptySchemaPayload(trimmed, baseType);
				const model =
					baseType === "DOCKPART"
						? ConnectSchemaModel.create(payload as any)
						: SchemaModel.create(payload as any);
				await rootStore.configSchemas.createSchema(model, authStore.getDomain() ?? undefined);
				message.success(langtext("general.schema_create_success"));
				setSchemaId("");
				onCreated(trimmed);
			} catch (error) {
				message.error(
					error instanceof Error ? error.message : langtext("general.schema_create_failed")
				);
			} finally {
				setSubmitting(false);
			}
		};

		return (
			<Modal
				title={langtext("general.schema_create")}
				open={open}
				onCancel={onClose}
				onOk={handleSubmit}
				confirmLoading={submitting}
				destroyOnClose
			>
				<Form layout="vertical">
					<Form.Item label={langtext("general.schema_create_id_label")} required>
						<Input
							value={schemaId}
							onChange={(e) => setSchemaId(e.target.value)}
							placeholder="MY-TYPE"
						/>
					</Form.Item>
				</Form>
			</Modal>
		);
	}
);

export default CreateSchemaDialog;
