import React from "react";
import { Button, List, Modal, Space } from "antd";
import { observer } from "mobx-react";
import { useNavigate } from "react-router-dom";
import authStore from "../../Stores/Auth.Store";
import { rootStore } from "../../Stores/Root.Store";
import { useLangtext } from "../../lib/common";
import {
	addValidationRule,
	searchQueryToValidationXPath,
	snapshotValidationRules,
} from "../../lib/elementXPathValidation";
import ElementSignalBars from "../ChangeMode/ElementSignalBars";
import { elementStatusShowsIndicator } from "../../lib/elementStatusStyle";

const ElementSearchHitsDialog: React.FC = observer(() => {
	const langtext = useLangtext();
	const navigate = useNavigate();
	const hits = rootStore.ui.elementSearchHits;
	const query = rootStore.ui.elementSearchText.trim();
	const canEdit = !rootStore.ui.isReadOnly && !!rootStore.ui.activeView;

	const close = () => rootStore.ui.setElementSearchDialogOpen(false);

	const openHit = (id: string, className: string) => {
		if (className === "View") {
			navigate(`/${authStore.getDomain()}/am/${id}`);
			close();
			return;
		}
		if (className === "Connection") {
			navigate(
				`/${authStore.getDomain()}/am/${rootStore.ui.activeView?.id}/element/${id}`
			);
			rootStore.ui.setActiveElementById(id);
			close();
			return;
		}
		navigate(`/${authStore.getDomain()}/am/${rootStore.ui.activeView?.id}/element/${id}`);
		close();
	};

	const saveRule = (polarity: "positive" | "negative") => {
		const view = rootStore.ui.activeView;
		const xpath = searchQueryToValidationXPath(query);
		if (!view || !xpath) {
			return;
		}
		view.setValidationRules(
			addValidationRule(snapshotValidationRules(view.validationRules), xpath, query, polarity)
		);
	};

	return (
		<Modal
			open={rootStore.ui.elementSearchDialogOpen}
			title={langtext("general.element_search_hits_title")}
			onCancel={close}
			footer={
				<Space wrap>
					<Button
						disabled={!canEdit || !query}
						onClick={() => saveRule("positive")}
					>
						{langtext("general.element_search_save_positive")}
					</Button>
					<Button
						disabled={!canEdit || !query}
						onClick={() => saveRule("negative")}
					>
						{langtext("general.element_search_save_negative")}
					</Button>
					<Button onClick={close}>{langtext("general.close")}</Button>
				</Space>
			}
		>
			<p className="element-search-hits__query">{query || "—"}</p>
			<List
				size="small"
				locale={{ emptyText: langtext("general.element_search_hits_empty") }}
				dataSource={hits}
				renderItem={(hit) => (
					<List.Item
						className="element-search-hits__item"
						onClick={() => openHit(hit.id, hit.class)}
					>
						<span className="element-search-hits__label">
							{hit.class} — {hit.title}
						</span>
						<ElementSignalBars
							flags={{
								changed: elementStatusShowsIndicator(hit.status as never),
								positive: hit.positive,
								negative: hit.negative,
							}}
						/>
					</List.Item>
				)}
			/>
		</Modal>
	);
});

export default ElementSearchHitsDialog;
