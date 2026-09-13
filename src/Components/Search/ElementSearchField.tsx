import React, { useEffect, useState } from "react";
import { Input } from "antd";
import { observer } from "mobx-react";
import { rootStore } from "../../Stores/Root.Store";
import { useLangtext } from "../../lib/common";

const ElementSearchField: React.FC = observer(() => {
	const langtext = useLangtext();
	const [draft, setDraft] = useState(rootStore.ui.elementSearchText);

	useEffect(() => {
		setDraft(rootStore.ui.elementSearchText);
	}, [rootStore.ui.elementSearchText]);

	const submit = (value: string) => {
		const next = value;
		setDraft(next);
		rootStore.ui.setElementSearchText(next);
		rootStore.ui.setElementSearchDialogOpen(true);
	};

	return (
		<Input.Search
			id="isr-element-search"
			className="element-search-field"
			allowClear
			value={draft}
			placeholder={langtext("general.element_search_placeholder")}
			onChange={(event) => setDraft(event.target.value)}
			onSearch={submit}
		/>
	);
});

export default ElementSearchField;
