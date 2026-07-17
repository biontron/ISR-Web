/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { ReactNode, useCallback, useRef, useState } from "react";

interface SchemaManagerSplitLayoutProps {
	top: ReactNode;
	bottom: ReactNode;
	/** Anteil der oberen Fläche (0–1), Standard 0.5 */
	initialTopRatio?: number;
}

const MIN_RATIO = 0.15;
const MAX_RATIO = 0.85;

const SchemaManagerSplitLayout: React.FC<SchemaManagerSplitLayoutProps> = ({
	top,
	bottom,
	initialTopRatio = 0.5,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const [topRatio, setTopRatio] = useState(initialTopRatio);

	const handleResizeStart = useCallback((event: React.MouseEvent) => {
		event.preventDefault();
		const container = containerRef.current;
		if (!container) {
			return;
		}

		const onMouseMove = (moveEvent: MouseEvent) => {
			const rect = container.getBoundingClientRect();
			const nextRatio = (moveEvent.clientY - rect.top) / rect.height;
			setTopRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, nextRatio)));
		};

		const onMouseUp = () => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};

		document.body.style.cursor = "row-resize";
		document.body.style.userSelect = "none";
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
	}, []);

	return (
		<div ref={containerRef} className="schema-manager-split">
			<div
				className="schema-manager-split-top"
				style={{ flex: `${topRatio} 1 0%` }}
			>
				{top}
			</div>
			<div
				className="schema-manager-split-handle"
				role="separator"
				aria-orientation="horizontal"
				aria-valuenow={Math.round(topRatio * 100)}
				onMouseDown={handleResizeStart}
			/>
			<div
				className="schema-manager-split-bottom"
				style={{ flex: `${1 - topRatio} 1 0%` }}
			>
				{bottom}
			</div>
		</div>
	);
};

export default SchemaManagerSplitLayout;
