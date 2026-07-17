import React from "react";
import { observer } from "mobx-react";
import { ElementStatus } from "../../Stores/Models/Element.Model";
import { elementStatusShowsIndicator } from "../../lib/elementStatusStyle";

interface ElementStatusDotProps {
	status?: ElementStatus | string;
}

const ElementStatusDot: React.FC<ElementStatusDotProps> = observer(({ status }) => {
	const elementStatus = status as ElementStatus | undefined;

	if (!elementStatusShowsIndicator(elementStatus)) {
		return null;
	}

	return (
		<span
			className={`element-status-dot element-status-dot--${elementStatus}`}
			aria-hidden="true"
		/>
	);
});

export default ElementStatusDot;
