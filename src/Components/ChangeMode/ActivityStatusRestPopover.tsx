/*
	========================================================================
	LICENSE AGREEMENT — siehe ActivityStatusOverviewModal
	========================================================================
*/

import React, { useRef, useState } from "react";
import { Popover, message } from "antd";
import { ActivityStatusRow } from "../../lib/activityStatusOverview";
import {
	buildRestCommunicationCopyText,
	copyTextToClipboard,
	hasRestCommunicationDetail,
} from "../../lib/activityStatusCopy";
import { useLangtext } from "../../lib/common";
import DetailPanelShell from "./DetailPanelShell";
import RestCommunicationView from "./RestCommunicationView";

interface ActivityStatusRestPopoverProps {
	row: ActivityStatusRow;
	children: React.ReactElement;
}

const ActivityStatusRestPopover: React.FC<ActivityStatusRestPopoverProps> = ({ row, children }) => {
	const langtext = useLangtext();
	const [open, setOpen] = useState(false);
	const hideTimerRef = useRef<number | undefined>(undefined);

	if (!hasRestCommunicationDetail(row)) {
		return children;
	}

	const clearHideTimer = () => {
		if (hideTimerRef.current != null) {
			window.clearTimeout(hideTimerRef.current);
			hideTimerRef.current = undefined;
		}
	};

	const scheduleHide = () => {
		clearHideTimer();
		hideTimerRef.current = window.setTimeout(() => setOpen(false), 180);
	};

	const show = () => {
		clearHideTimer();
		setOpen(true);
	};

	const handleMouseEnter = () => {
		show();
	};

	const handleMouseLeave = () => {
		scheduleHide();
	};

	const handleCopy = async () => {
		const ok = await copyTextToClipboard(buildRestCommunicationCopyText(row));
		if (ok) {
			message.success(langtext("general.activity_status_copy_error_success"));
		} else {
			message.error(langtext("general.json_inspect_copy_failed"));
		}
	};

	const handleClose = () => {
		clearHideTimer();
		setOpen(false);
	};

	const content = (
		<div
			className="detail-panel-popover"
			style={{ width: 760 }}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			<DetailPanelShell
				title={langtext("general.activity_status_http_detail_title")}
				onCopy={handleCopy}
				onClose={handleClose}
			>
				<RestCommunicationView row={row} />
			</DetailPanelShell>
		</div>
	);

	return (
		<Popover
			open={open}
			content={content}
			overlayClassName="detail-panel-popover-overlay"
			destroyTooltipOnHide={false}
			arrow={false}
		>
			<span
				className="detail-panel-popover-trigger"
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
			>
				{children}
			</span>
		</Popover>
	);
};

export default ActivityStatusRestPopover;
