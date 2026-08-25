import CustomerLogin from "./Components/Base/CustomerLogin.Component";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import CommonLayout from "./Components/Base/Common.Component";
import authStore from "./Stores/Auth.Store";
import React, { PropsWithChildren } from "react";
import { rootStore } from "./Stores/Root.Store";
import AssetManagement from "./Apps/AssetManagement/AssetManagement";
import SchemaManagement from "./Apps/SchemaManagement/SchemaManagement";
import IaCTemplateManagement from "./Apps/IaCTemplateManagement/IaCTemplateManagement";
import Test from "./Test";
import Logout from "./Components/Base/Logout";

// Security Wrapper Component
const ProtectedRoute: React.FC<PropsWithChildren> = ({ children }) => {
	const isLoggedIn = authStore.isLoggedIn();
	const domain = authStore.getDomain();

	if (isLoggedIn && domain) return <>{children}</>;
	return <Navigate to="/login" replace />;
};

const router = createBrowserRouter([
	{
		path: "/",
		element: <CustomerLogin />,
	},
	{
		path: "/login",
		element: <CustomerLogin />,
	},
	{
		path: "/logout",
		element: <Logout />,
	},
	{
		path: "/:domain/",
		loader: async ({ params }) => {
			const domain = params.domain;
			if (domain) {
				authStore.setDomain(domain);
			}
			await rootStore.configSchemas.loadAll(domain);
			return null;
		},
		element: (
			<ProtectedRoute>
				<CommonLayout>
					<Outlet />
				</CommonLayout>
			</ProtectedRoute>
		),
		children: [
			{
				path: "/:domain/sm",
				element: <SchemaManagement />,
			},
			{
				path: "/:domain/dsm",
				element: <Navigate to="../sm?tab=DOCKPART" replace />,
			},
			{
				path: "/:domain/im",
				element: <IaCTemplateManagement />,
				loader: async ({ params }) => {
					const domain = params.domain;
					if (!domain) {
						return null;
					}
					await rootStore.iac.loadPackages(domain);
					return null;
				},
			},
			{
				path: "/:domain/am/",
				element: <AssetManagement />,
				loader: async ({ params }) => {
					const domain = params.domain;
					await rootStore.configSchemas.loadByBaseType("DOCKPART", domain);
					await rootStore.views.load();
					await rootStore.assets.loadAssets();
					await rootStore.connections.load();

					return null;
				},
				children: [
					{
						path: "/:domain/am/:view",
						shouldRevalidate: ({ currentParams, nextParams }) =>
							currentParams.view !== nextParams.view,
						loader: async ({ params }) => {
							rootStore.ui.setActiveView(params.view as any);
							await rootStore.groups.load(params.view!);
							rootStore.ui.setActiveElementById(params.view!);
							return null;
						},
						element: <AssetManagement />,
						children: [
							{
								path: "/:domain/am/:view/element/:element",
								loader: async ({ params }) => {
									rootStore.ui.setActiveElementById(params.element as any);
									return null;
								},
								element: <AssetManagement />,
							},
						],
					},
				],
			},
		],
	},
	{
		path: "/:domain/test",
		element: (
			<CommonLayout>
				<Test />
			</CommonLayout>
		),
	}
],
{
	basename: "/app",  // Root der Anwendung
});

export default router;
