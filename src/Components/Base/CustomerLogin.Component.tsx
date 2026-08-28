/*
# SPDX-License-Identifier: GPL-2.0*/

import React, { useState } from "react";
import { observer } from "mobx-react";
import { useNavigate } from "react-router-dom";
import { Card, Form, Input, Button, AutoComplete, Checkbox, Alert } from "antd";
import { rootStore } from "../../Stores/Root.Store";
import authStore from "../../Stores/Auth.Store";
import { useLangtext } from "../../lib/common";

const CustomerLogin: React.FC = observer(() => {
	const navigate = useNavigate();
	const [form] = Form.useForm();
	const langtext = useLangtext();
	const lastMessage = authStore.getLastMessage();
	const [domainOptions, setDomainOptions] = useState(
		authStore.knownDomains.map((domain: string) => ({ value: domain }))
	);

	// Bestimme die initiale Domain (erste bekannte Domain oder config.domain als Fallback)
	const initialDomain = authStore.knownDomains.length > 0
		? authStore.knownDomains[0]
		: rootStore.config.domain;

	const handleRememberChange = (e: any) => {
		authStore.setShouldRemember(e.target.checked);
		if (!e.target.checked) {
			form.setFieldsValue({
				username: "",
				domain: rootStore.config.domain
			});
		}
	};

	const handleLogin = async (values: any) => {
		const { username, password, domain } = values;
		await authStore.login(username, password, domain);
		if (authStore.isLoggedIn()) {
			setDomainOptions(authStore.knownDomains.map((domain: string) => ({ value: domain })));
			navigate(`/${authStore.getDomain()}/am`);
		}
	};

	const handleDomainSearch = (searchText: string) => {
		const knownDomains = authStore.knownDomains;
		let filteredOptions = knownDomains
			.filter((domain: string) => domain.toLowerCase().includes(searchText.toLowerCase()))
			.map((domain: string) => ({ value: domain }));

		if (filteredOptions.length === 0 && searchText) {
			filteredOptions = [{ value: searchText }];
		}

		setDomainOptions(filteredOptions);
	};

	return (
		<div style={{
			display: "flex",
			alignItems: "center",
			// justifyContent: "center",
			width: "100vw",
			height: "100vh",
			backgroundImage: "url('/app/logo.svg')",
			backgroundSize: "cover"
		}}>
			<Card style={{ width: "40ex" }}>
				<Form form={form} onFinish={handleLogin} layout="vertical">
					<Form.Item
						label={langtext("general.account_username")}
						name="username"
						initialValue={authStore.username}
						rules={[{ required: true, message: langtext("general.account_username_required") }]}
					>
						<Input name="username"/>
					</Form.Item>
					<Form.Item
						label={langtext("general.account_password")}
						name="password"
						rules={[{ required: true, message: langtext("general.account_password_required") }]}
					>
						<Input.Password name="password"/>
					</Form.Item>
					<Form.Item
						label={langtext("general.account_domain")}
						name="domain"
						initialValue={initialDomain}
						rules={[{ required: true, message: langtext("general.account_domain_required") }]}
					>
						<AutoComplete
							options={domainOptions}
							onSearch={handleDomainSearch}
							placeholder={langtext("general.account_domain_placeholder")}
							style={{ width: "100%" }}
							defaultOpen={authStore.knownDomains.length > 0}
							allowClear
						/>
					</Form.Item>
					<Form.Item
						name="remember"
						valuePropName="checked"
						initialValue={authStore.shouldRemember}
					>
						<Checkbox onChange={handleRememberChange}>{langtext("general.account_remember")}</Checkbox>
					</Form.Item>
					<Form.Item>
						<Button type="primary" name="login" htmlType="submit">
							{langtext("general.account_login")}
						</Button>
					</Form.Item>
					{lastMessage !== "" && (
						<Alert
							className="login-message"
							type={authStore.lastMessageType === "success" ? "success" : "error"}
							message={lastMessage}
							showIcon
						/>
					)}
				</Form>
			</Card>
		</div>
	);
});

export default CustomerLogin;
