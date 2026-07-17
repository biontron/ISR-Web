/*
	========================================================================
	LICENSE AGREEMENT — siehe ActivityStatusOverviewModal
	========================================================================
*/

import React from "react";
import { Button, Space } from "antd";
import { CloseOutlined, CopyOutlined } from "@ant-design/icons";
import { useLangtext } from "../../lib/common";

type DetailPanelShellProps = React.PropsWithChildren<{
	title: string;
	onCopy?: () => void;
	onClose?: () => void;
	className?: string;
}>;

function DetailPanelShell({
	title,
	onCopy,
	onClose,
	children,
	className,
}: DetailPanelShellProps) {
	const langtext = useLangtext();

	return (
		<div className={`detail-panel ${className ?? ""}`.trim()}>
			<div className="detail-panel__header">
				<span className="detail-panel__title">{title}</span>
				<Space size={0}>
					{onCopy ? (
						<Button
							type="text"
							size="small"
							icon={<CopyOutlined />}
							aria-label={langtext("general.json_inspect_copy")}
							title={langtext("general.json_inspect_copy")}
							onClick={(event) => {
								event.stopPropagation();
								onCopy();
							}}
						/>
					) : null}
					{onClose ? (
						<Button
							type="text"
							size="small"
							icon={<CloseOutlined />}
							aria-label={langtext("general.activity_status_close")}
							title={langtext("general.activity_status_close")}
							onClick={(event) => {
								event.stopPropagation();
								onClose();
							}}
						/>
					) : null}
				</Space>
			</div>
			<div className="detail-panel__body">{children}</div>
		</div>
	);
}

export default DetailPanelShell;
