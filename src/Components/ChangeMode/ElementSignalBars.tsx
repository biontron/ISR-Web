import React from "react";
import {
	buildElementSignalBarsClassName,
	type SignalBarFlags,
} from "../../lib/elementSignalBars";

interface ElementSignalBarsProps {
	flags?: SignalBarFlags;
	orientation?: "vertical" | "horizontal";
}

const ElementSignalBars: React.FC<ElementSignalBarsProps> = ({
	flags,
	orientation = "vertical",
}) => (
	<span className={buildElementSignalBarsClassName(orientation)} aria-hidden="true">
		<span
			className={`element-signal-bars__seg element-signal-bars__seg--changed ${flags?.changed ? "is-on" : "is-off"}`}
		/>
		<span
			className={`element-signal-bars__seg element-signal-bars__seg--positive ${flags?.positive ? "is-on" : "is-off"}`}
		/>
		<span
			className={`element-signal-bars__seg element-signal-bars__seg--negative ${flags?.negative ? "is-on" : "is-off"}`}
		/>
	</span>
);

export default ElementSignalBars;
