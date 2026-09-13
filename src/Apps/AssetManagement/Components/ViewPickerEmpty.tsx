import React from "react";
import { observer } from "mobx-react";
import { Empty } from "antd";
import { useNavigate } from "react-router-dom";
import { rootStore } from "../../../Stores/Root.Store";
import authStore from "../../../Stores/Auth.Store";
import { IView } from "../../../Stores/Models/View.Model";
import SchemaSvgIcon from "../../../Components/Schema/SchemaSvgIcon";
import ElementStatusDot from "../../../Components/ChangeMode/ElementStatusDot";
import { useLangtext } from "../../../lib/common";

const ViewPickerEmpty: React.FC = observer(() => {
	const langtext = useLangtext();
	const navigate = useNavigate();
	const views = rootStore.views.views;

	const openView = (view: IView) => {
		navigate(`/${authStore.getDomain()}/am/${view.id}`);
	};

	return (
		<div className="view-picker-empty">
			<h2 className="view-picker-empty__title">{langtext("general.view_picker_title")}</h2>
			{views.length === 0 ? (
				<Empty description={langtext("general.view_picker_empty")} />
			) : (
				<ul className="view-picker-empty__list">
					{views.map((view) => (
						<li key={view.id}>
							<button
								type="button"
								className="view-picker-empty__item"
								onClick={() => openView(view)}
							>
								<SchemaSvgIcon
									svgString={rootStore.configSchemas.getIconByDefinition(view.definition)}
									element={view}
								/>
								<ElementStatusDot status={view.status} />
								<span className="view-picker-empty__name">{view.definition.name}</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
});

export default ViewPickerEmpty;
