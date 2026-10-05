/*
# SPDX-License-Identifier: GPL-2.0
*/
import { Button } from "antd";
import { observer } from "mobx-react";
import React from "react";
import { useLangtext } from "../../../lib/common";
import { readGraphArchitectures } from "../../../lib/graphViewModel";
import { rootStore } from "../../../Stores/Root.Store";
import { GraphArchitectureSettings } from "./GraphArchitectureSettings";

const EnvironmentGraphSettings: React.FC<{ environmentId: string; canEdit: boolean }> = ({
	environmentId,
	canEdit,
}) => {
	const langtext = useLangtext();
	const environment = rootStore.environments.findById(environmentId);
	const [saving, setSaving] = React.useState(false);

	if (!environment) {
		return null;
	}

	const save = async () => {
		setSaving(true);
		try {
			await rootStore.environments.persist(environment);
			environment.commitIgnoredDevices();
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="environment-settings__block">
			<GraphArchitectureSettings
				architectures={readGraphArchitectures(environment.properties.graph)}
				canEdit={canEdit}
				onChange={(next) => environment.setGraphRepresentations(next)}
			/>
			<Button
				type="primary"
				style={{ marginTop: 12 }}
				disabled={!canEdit || environment.status !== "changed"}
				loading={saving}
				onClick={() => void save()}
			>
				{langtext("general.edit_store")}
			</Button>
		</div>
	);
};

export default observer(EnvironmentGraphSettings);
