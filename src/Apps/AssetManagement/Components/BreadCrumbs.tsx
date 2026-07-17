import { Breadcrumb } from "antd";
import BreadcrumbItem from "antd/es/breadcrumb/BreadcrumbItem";
import { observer } from "mobx-react";
import { rootStore } from "../../../Stores/Root.Store";
import { ElementInfo } from "./ElementInfo.Component";

type Props = {};

export const BreadCrumbs = observer((props: Props) => {
	const { activeView, activeElement } = rootStore.ui;
	return (
		<Breadcrumb style={{ margin: "0" }} separator=" > ">
			{activeView != null && <BreadcrumbItem><ElementInfo element={activeView}/></BreadcrumbItem>}
			{activeElement && activeElement.class !== "View" && <BreadcrumbItem><ElementInfo element={activeElement}/></BreadcrumbItem>}
		</Breadcrumb>
	);
});
