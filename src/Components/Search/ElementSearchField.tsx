import React, { useEffect, useState } from "react";
import { Input } from "antd";
import { observer } from "mobx-react";
import { rootStore } from "../../Stores/Root.Store";
import { useLangtext } from "../../lib/common";

const SEARCH_DEBOUNCE_MS = 250;

const ElementSearchField: React.FC = observer(() => {
	const langtext = useLangtext();
	const [draft, setDraft] = useState(rootStore.ui.elementSearchText);
	const enabled = !!rootStore.ui.activeView;

	useEffect(() => {
		setDraft(rootStore.ui.elementSearchText);
	}, [rootStore.ui.elementSearchText]);

	useEffect(() => {
		const handle = window.setTimeout(() => {
			if (draft !== rootStore.ui.elementSearchText) {
				rootStore.ui.setElementSearchText(draft);
			}
		}, SEARCH_DEBOUNCE_MS);
		return () => window.clearTimeout(handle);
	}, [draft]);

	const submit = () => {
		rootStore.ui.setElementSearchText(draft);
		if (draft.trim()) {
			rootStore.ui.setElementSearchDialogOpen(true);
		}
	};

	return (
		<Input.Search
			className="element-search-field"
			allowClear
			disabled={!enabled}
			value={draft}
			placeholder={langtext("general.element_search_placeholder")}
			onChange={(event) => setDraft(event.target.value)}
			onSearch={submit}
		/>
	);
});

export default ElementSearchField;
