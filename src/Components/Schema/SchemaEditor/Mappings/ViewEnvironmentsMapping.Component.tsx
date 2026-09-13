import React from "react";
import { Button, List, Radio } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { observer } from "mobx-react";
import { IView } from "../../../../Stores/Models/View.Model";
import { rootStore } from "../../../../Stores/Root.Store";
import { useLangtext } from "../../../../lib/common";
import { environmentDisplayName } from "../../../../Stores/Models/Environment.Model";
import {
	readViewEnvironmentBindings,
	resolvePrimaryEnvironmentRef,
	withSinglePrimary,
} from "../../../../lib/viewEnvironments";

const ViewEnvironmentsMapping: React.FC<{ view: IView }> = observer(({ view }) => {
	const langtext = useLangtext();
	const canEdit = !rootStore.ui.isReadOnly;
	const bindings = readViewEnvironmentBindings(view);
	const bound = new Set(bindings.map((entry) => entry.ref));
	const primaryRef = resolvePrimaryEnvironmentRef(view);
	const available = rootStore.environments.environments.filter((environment) => !bound.has(environment.id));

	const persist = (next: Array<{ ref: string; primary?: boolean }>) => {
		view.setEnvironments(next);
	};

	return (
		<>
			<p className="schema-editor-empty__message">
				{langtext("general.view_environments_hint")}
			</p>
			<List
				dataSource={bindings}
				locale={{ emptyText: langtext("general.view_environments_empty") }}
				renderItem={(entry) => {
					const environment = rootStore.environments.findById(entry.ref);
					return (
						<List.Item
							actions={
								canEdit
									? [
											<Button
												key="remove"
												type="text"
												danger
												icon={<DeleteOutlined />}
												onClick={() => persist(bindings.filter((item) => item.ref !== entry.ref))}
											/>,
									  ]
									: []
							}
						>
							<Radio
								checked={entry.ref === primaryRef}
								disabled={!canEdit}
								onChange={() => persist(withSinglePrimary(bindings, entry.ref))}
							>
								{environment ? environmentDisplayName(environment) : entry.ref}
								{entry.ref === primaryRef ? ` (${langtext("general.view_environments_primary")})` : ""}
							</Radio>
						</List.Item>
					);
				}}
			/>
			{canEdit && available.length > 0 ? (
				<List
					header={langtext("general.view_environments_available")}
					dataSource={available}
					renderItem={(environment) => (
						<List.Item
							actions={[
								<Button
									key="add"
									type="link"
									icon={<PlusOutlined />}
									onClick={() =>
										persist([
											...bindings,
											{ ref: environment.id, primary: bindings.length === 0 },
										])
									}
								>
									{langtext("general.add")}
								</Button>,
							]}
						>
							{environmentDisplayName(environment)}
						</List.Item>
					)}
				/>
			) : null}
		</>
	);
});

export default ViewEnvironmentsMapping;
