import React from "react";
import { Button, message } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { useLangtext } from "../../lib/common";
import { copyTextToClipboard } from "../../lib/activityStatusCopy";

type CopyToClipboardButtonProps = {
	text: string;
	disabled?: boolean;
};

const CopyToClipboardButton: React.FC<CopyToClipboardButtonProps> = ({ text, disabled }) => {
	const langtext = useLangtext();

	const handleCopy = async () => {
		const ok = await copyTextToClipboard(text);
		if (ok) {
			message.success(langtext("general.json_inspect_copy_success"));
		} else {
			message.error(langtext("general.json_inspect_copy_failed"));
		}
	};

	return (
		<Button
			type="text"
			size="small"
			icon={<CopyOutlined />}
			disabled={disabled || text === ""}
			aria-label={langtext("general.json_inspect_copy")}
			title={langtext("general.json_inspect_copy")}
			onClick={(event) => {
				event.stopPropagation();
				void handleCopy();
			}}
		/>
	);
};

export default CopyToClipboardButton;
