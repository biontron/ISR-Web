import React, { useEffect } from "react";
import authStore from "../../Stores/Auth.Store";
import { useNavigate } from "react-router";

interface LogoutProps {}

const Logout: React.FC<LogoutProps> = (props) => {
	const navigate = useNavigate();

	useEffect(() => {
		async function logout() {
			await authStore.logout();
			navigate("/login");
		}
		logout();
	}, [navigate]);

	return <></>;
};

export default Logout;
