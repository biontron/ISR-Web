import React, { Fragment } from "react";
import { Empty } from "antd";
import { observer } from "mobx-react";
import { rootStore } from "../../Stores/Root.Store";
import { IAsset } from "../../Stores/Models/Asset.Model";
import ConnectionMapping from "../Schema/SchemaEditor/Mappings/ConnectionMapping.Component";
import AssetDocksSection from "../../Apps/AssetManagement/Components/AssetDocksSection";
import { useLangtext } from "../../lib/common";

type AssetConnectionManagerPanelProps = {
	assetId: string | null | undefined;
};

const AssetConnectionManagerPanel: React.FC<AssetConnectionManagerPanelProps> = observer(
	({ assetId }) => {
		const langtext = useLangtext();
		const canEdit = !rootStore.ui.isReadOnly;
		const asset = assetId
			? rootStore.assets.assets.find((entry) => entry.id === assetId)
			: undefined;

		if (!asset) {
			return <Empty description={langtext("general.connection_dialog_no_asset")} />;
		}

		return (
			<div className="connection-dialog__asset-panel">
				<AssetDocksSection asset={asset as IAsset} canEdit={canEdit && rootStore.ui.canEditActiveElement()} />
				<ConnectionMapping element={asset as IAsset} />
			</div>
		);
	}
);

export default AssetConnectionManagerPanel;
