/*
# SPDX-License-Identifier: GPL-2.0
*/
import { Button, Divider, Input, Tooltip } from "antd";
import { observer } from "mobx-react";
import React from "react";
import { useLangtext } from "../../../lib/common";
import { readViewEnvironmentBindings } from "../../../lib/viewEnvironments";
import { environmentDisplayName, IEnvironment } from "../../../Stores/Models/Environment.Model";
import { IView } from "../../../Stores/Models/View.Model";
import { rootStore } from "../../../Stores/Root.Store";

const IgnoredDeviceNameField = observer(function IgnoredDeviceNameField({
	environment,
	index,
}: {
	environment: IEnvironment;
	index: number;
}) {
	const stored = environment.properties.ignoredDevices[index] ?? "";
	const [value, setValue] = React.useState(stored);

	React.useEffect(() => {
		setValue(stored);
	}, [stored]);

	const commit = () => {
		const next = environment.properties.ignoredDevices.slice();
		next[index] = value;
		environment.setIgnoredDevices(next);
	};

	return (
		<Input
			size="small"
			value={value}
			onChange={(event) => setValue(event.target.value)}
			onBlur={commit}
			onPressEnter={(event) => (event.target as HTMLInputElement).blur()}
		/>
	);
});

const IgnoredDevicesEditor = observer(function IgnoredDevicesEditor({
	environment,
	showEnvironmentName,
	canEdit,
}: {
	environment: IEnvironment;
	showEnvironmentName: boolean;
	canEdit: boolean;
}) {
	const langtext = useLangtext();
	const [draft, setDraft] = React.useState("");
	const names = environment.properties.ignoredDevices;

	const addName = () => {
		const name = draft.trim();
		if (!name) {
			return;
		}
		environment.setIgnoredDevices([...names, name]);
		setDraft("");
	};

	return (
		<div className="environment-settings__block">
			{showEnvironmentName ? (
				<div className="environment-settings__name">{environmentDisplayName(environment)}</div>
			) : null}
			<div className="environment-settings__label">{langtext("general.tree_unlinked_ignore_list")}</div>
			{names.length === 0 && !canEdit ? (
				<div className="schema-editor-empty__message">{langtext("general.environment_settings_ignored_empty")}</div>
			) : null}
			{names.map((name, index) =>
				canEdit ? (
					<div className="environment-settings__row" key={`${environment.id}:${index}:${name}`}>
						<IgnoredDeviceNameField environment={environment} index={index} />
						<Button
							size="small"
							onClick={() =>
								environment.setIgnoredDevices(names.filter((_, entryIndex) => entryIndex !== index))
							}
						>
							{langtext("general.tree_unlinked_ignore_remove")}
						</Button>
					</div>
				) : (
					<div className="environment-settings__row" key={`${environment.id}:${name}`}>
						{name}
					</div>
				)
			)}
			{canEdit ? (
				<div className="environment-settings__row">
					<Input
						size="small"
						value={draft}
						placeholder={langtext("general.tree_unlinked_ignore_placeholder")}
						onChange={(event) => setDraft(event.target.value)}
						onPressEnter={addName}
					/>
					<Button size="small" onClick={addName}>
						{langtext("general.tree_unlinked_ignore_add")}
					</Button>
				</div>
			) : null}
		</div>
	);
});

const EnvironmentSettings: React.FC<{ view: IView }> = ({ view }) => {
	const langtext = useLangtext();
	const canEdit = !rootStore.ui.isReadOnly;
	const environments = readViewEnvironmentBindings(view)
		.map((binding) => rootStore.environments.findById(binding.ref))
		.filter((environment): environment is IEnvironment => !!environment);

	return (
		<section className="element-properties-section">
			<Tooltip title={langtext("general.environment_settings_hint")}>
				<Divider>{langtext("general.environment_settings")}</Divider>
			</Tooltip>
			{environments.length === 0 ? (
				<div className="schema-editor-empty__message">{langtext("general.view_environments_empty")}</div>
			) : (
				environments.map((environment) => (
					<IgnoredDevicesEditor
						key={environment.id}
						environment={environment}
						showEnvironmentName={environments.length > 1}
						canEdit={canEdit}
					/>
				))
			)}
		</section>
	);
};

export default observer(EnvironmentSettings);
