/*
	========================================================================
	LICENSE AGREEMENT — siehe ActivityStatusOverviewModal
	========================================================================
*/

import React from "react";
import { Space, Typography } from "antd";
import { ActivityStatusRow } from "../../lib/activityStatusOverview";
import { useLangtext } from "../../lib/common";
import {
	formatResponseHeadersForDisplay,
	getHttpStatusToneClass,
} from "../../lib/storeFailureFormat";

interface RestCommunicationViewProps {
	row: ActivityStatusRow;
}

const RestCommunicationView: React.FC<RestCommunicationViewProps> = ({ row }) => {
	const langtext = useLangtext();
	const headers = formatResponseHeadersForDisplay(row.rest.responseHeaders);
	const httpLine =
		row.isNetworkError
			? langtext("general.activity_status_http_network")
			: row.httpStatus != null
				? `HTTP ${row.httpStatus}${row.httpStatusText ? ` ${row.httpStatusText}` : ""}`.trim()
				: undefined;

	return (
		<div className="rest-communication-view">
			{row.errorMessage ? (
				<Typography.Paragraph style={{ marginBottom: 12 }}>{row.errorMessage}</Typography.Paragraph>
			) : null}

			{(row.rest.method || row.rest.fullUrl) && (
				<Space direction="vertical" size={0} style={{ display: "flex", marginBottom: 12 }}>
					{row.rest.method ? <Typography.Text code>{row.rest.method}</Typography.Text> : null}
					{row.rest.fullUrl ? (
						<Typography.Text type="secondary" copyable>
							{row.rest.fullUrl}
						</Typography.Text>
					) : null}
				</Space>
			)}

			{httpLine ? (
				<Typography.Paragraph style={{ marginBottom: 12 }}>
					<span className={getHttpStatusToneClass(row.httpStatus, row.isNetworkError)}>
						{httpLine}
					</span>
				</Typography.Paragraph>
			) : null}

			{headers ? (
				<div className="rest-communication-view__section">
					<Typography.Text strong>{langtext("general.activity_status_http_headers")}</Typography.Text>
					<pre className="detail-panel__mono">{headers}</pre>
				</div>
			) : null}

			{row.rest.responseBody ? (
				<div className="rest-communication-view__response">
					<Typography.Text strong>{langtext("general.json_inspect_response")}:</Typography.Text>
					<pre className="detail-panel__mono detail-panel__mono--danger">
						{row.rest.responseBody}
					</pre>
				</div>
			) : null}
		</div>
	);
};

export default RestCommunicationView;
