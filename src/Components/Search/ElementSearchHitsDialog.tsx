import React from "react";
import { Button, List, Modal, message } from "antd";
import { observer } from "mobx-react";
import { useNavigate } from "react-router-dom";
import authStore from "../../Stores/Auth.Store";
import { rootStore } from "../../Stores/Root.Store";
import { useLangtext } from "../../lib/common";
import { ELEMENT_SEARCH_EXAMPLES } from "../../lib/elementSearchExamples";
import { searchQueryToValidationXPath } from "../../lib/elementXPathValidation";
import ElementSignalBars from "../ChangeMode/ElementSignalBars";
import { elementStatusShowsIndicator } from "../../lib/elementStatusStyle";

const ElementSearchHitsDialog: React.FC = observer(() => {
	const langtext = useLangtext();
	const navigate = useNavigate();
	const hits = rootStore.ui.elementSearchHits;
	const query = rootStore.ui.elementSearchText.trim();
	const canSaveRule = !!query;

	const close = () => rootStore.ui.setElementSearchDialogOpen(false);

	const openHit = (id: string, className: string) => {
		if (className === "View") {
			navigate(`/${authStore.getDomain()}/am/${id}`);
			rootStore.ui.setActiveElementById(id);
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
		rootStore.ui.setActiveElementById(id);
		close();
	};

	const applyExample = (example: string) => {
		rootStore.ui.setElementSearchText(example);
	};

	const adoptRule = () => {
		if (rootStore.ui.isReadOnly) {
			Modal.error({
				title: langtext("general.element_search_adopt_need_edit_title"),
				content: langtext("general.element_search_adopt_need_edit"),
				zIndex: 2000,
			});
			return;
		}
		const activeView = rootStore.ui.activeView;
		const searchQuery = rootStore.ui.elementSearchText.trim();
		const xpath = searchQueryToValidationXPath(searchQuery);
		if (!activeView) {
			message.warning(langtext("general.element_search_save_no_view"));
			return;
		}
		if (!xpath) {
			message.warning(langtext("general.element_search_save_no_query"));
			return;
		}
		rootStore.ui.setPendingValidationRule(activeView.id, xpath, searchQuery);
		navigate(`/${authStore.getDomain()}/am/${activeView.id}`);
		rootStore.ui.setActiveElementById(activeView.id);
		close();
	};

	return (
		<Modal
			open={rootStore.ui.elementSearchDialogOpen}
			title={langtext("general.element_search_hits_title")}
			onCancel={close}
			footer={[
				<Button
					key="adopt"
					htmlType="button"
					disabled={!canSaveRule}
					onClick={adoptRule}
				>
					{langtext("general.element_search_adopt")}
				</Button>,
				<Button key="close" htmlType="button" onClick={close}>
					{langtext("general.close")}
				</Button>,
			]}
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
			<div className="element-search-hits__examples">
				<div className="element-search-hits__examples-title">
					{langtext("general.element_search_examples")}
				</div>
				<ul className="element-search-hits__examples-list">
					{ELEMENT_SEARCH_EXAMPLES.map((example) => (
						<li key={example}>
							<button
								type="button"
								className="element-search-hits__example"
								onClick={() => applyExample(example)}
							>
								<code>{example}</code>
							</button>
						</li>
					))}
				</ul>
			</div>
		</Modal>
	);
});

export default ElementSearchHitsDialog;
