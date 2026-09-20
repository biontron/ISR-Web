import React, { useRef, useState } from "react";
import { Button, Tooltip, message } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { observer } from "mobx-react";
import { IConnection } from "../../Stores/Models/Connection.Model";
import { useLangtext } from "../../lib/common";
import { copyTextToClipboard } from "../../lib/activityStatusCopy";
import { buildConnectionIccmHref, iccmUserErrorText, openIccmHref } from "../../lib/iccmLaunch";

type CommentHrefTooltipProps = {
	href: string;
	children: React.ReactElement;
};

export function CommentHrefTooltip({ href, children }: CommentHrefTooltipProps) {
	const langtext = useLangtext();

	const handleCopy = async (event: React.MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		const ok = await copyTextToClipboard(href);
		if (ok) {
			message.success(langtext("general.iccm_copy_success"));
		} else {
			message.error(langtext("general.iccm_copy_failed"));
		}
	};

	return (
		<Tooltip
			title={
				<div className="iccm-open-link-tooltip">
					<div className="iccm-open-link-tooltip__url">{href}</div>
					<Button type="text" size="small" icon={<CopyOutlined />} onClick={(event) => void handleCopy(event)}>
						{langtext("general.iccm_copy")}
					</Button>
				</div>
			}
			trigger="hover"
			mouseEnterDelay={0.15}
			mouseLeaveDelay={0.35}
			overlayClassName="iccm-open-link-tooltip-overlay"
		>
			{children}
		</Tooltip>
	);
}

type IccmOpenLinkProps = {
	href?: string;
	label?: string;
	variant?: "button" | "inline";
	loading?: boolean;
	onHover?: () => void;
	onOpen?: () => void;
};

const IccmOpenLink: React.FC<IccmOpenLinkProps> = ({
	href,
	label,
	variant = "button",
	loading = false,
	onHover,
	onOpen,
}) => {
	const langtext = useLangtext();

	const handleOpen = (event: React.MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		if (onOpen) {
			onOpen();
			return;
		}
		if (href) {
			openIccmHref(href);
		}
	};

	const text = label?.trim() || langtext("general.iccm_open");
	const trigger =
		variant === "inline" ? (
			<button
				type="button"
				className="schema-editor-comment-link schema-editor-comment-link--iccm"
				onClick={handleOpen}
				onMouseEnter={onHover}
			>
				{text}
			</button>
		) : (
			<Button type="link" size="small" onClick={handleOpen} onMouseEnter={onHover}>
				{text}
			</Button>
		);

	if (!href) {
		return (
			<Tooltip title={loading ? "…" : langtext("general.iccm_no_host")} trigger="hover">
				{trigger}
			</Tooltip>
		);
	}

	return <CommentHrefTooltip href={href}>{trigger}</CommentHrefTooltip>;
};

export const IccmConnectionOpenButton: React.FC<{ connection: IConnection }> = observer(
	({ connection }) => {
		const langtext = useLangtext();
		const [href, setHref] = useState<string>();
		const [loading, setLoading] = useState(false);
		const inflight = useRef<Promise<string | undefined>>();

		const ensureHref = () => {
			if (href) {
				return Promise.resolve(href);
			}
			if (!inflight.current) {
				setLoading(true);
				inflight.current = buildConnectionIccmHref(connection)
					.then((next) => {
						setHref(next);
						return next;
					})
					.catch((error) => {
						inflight.current = undefined;
						message.error(iccmUserErrorText(error, langtext));
						return undefined;
					})
					.finally(() => {
						setLoading(false);
					});
			}
			return inflight.current;
		};

		return (
			<IccmOpenLink
				href={href}
				loading={loading}
				onHover={() => void ensureHref()}
				onOpen={() => {
					void (async () => {
						const next = await ensureHref();
						if (next) {
							openIccmHref(next);
						}
					})();
				}}
			/>
		);
	}
);

export default IccmOpenLink;
