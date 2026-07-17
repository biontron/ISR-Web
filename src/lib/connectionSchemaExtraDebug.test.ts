import instanceFixture from "../../Documents/examples/CONNECTION-instance.json";
import connectionSchema from "../../Documents/examples/CONNECTION.json";
import {
	findExtraPathsInScope,
	hasSchemaValidationErrorsInScope,
} from "./schemaDeviation";
import { ConnectionModel, IConnection } from "../Stores/Models/Connection.Model";
import { ISchemaItem } from "../Stores/Types/SchemaItem";
import { buildSingleLinkSnapshot } from "./connectionStackTraversal";
import { IAsset } from "../Stores/Models/Asset.Model";

function connectionSchemaItems(): ISchemaItem[] {
	return connectionSchema.items as unknown as ISchemaItem[];
}

function connectionLinkpartsFieldItems(): ISchemaItem[] {
	const linksGroup = connectionSchemaItems().find(
		(item) => item.kind === "group" && item.dataStructure.itemName === "links"
	);
	if (linksGroup?.kind !== "group") {
		throw new Error("CONNECTION schema: links group missing");
	}

	const linkpartsGroup = linksGroup.items.find(
		(item) => item.kind === "group" && item.dataStructure.itemName === "linkparts"
	);
	if (linkpartsGroup?.kind !== "group") {
		throw new Error("CONNECTION schema: linkparts group missing");
	}

	return linkpartsGroup.items.slice() as ISchemaItem[];
}

describe("CONNECTION schema vs instance", () => {
	const schemaItems = connectionSchemaItems();
	const linkpartsFieldItems = connectionLinkpartsFieldItems();
	const connectionInstance: IConnection = ConnectionModel.create(instanceFixture);
	connectionInstance.setStatus("edit");

	const wizardFromAsset = {
		id: "from",
		definition: { name: "From App" },
		docks: [
			{
				id: "dFrom",
				label: "dFrom",
				type: "GENERIC",
				dockparts: [
					{ id: "2", type: "HTTP", protocol: "HTTP", label: "HTTP", basedOn: [] },
				],
			},
		],
	} as unknown as IAsset;
	const wizardToAsset = {
		id: "to",
		definition: { name: "To App" },
		docks: [
			{
				id: "dTo",
				label: "dTo",
				type: "GENERIC",
				dockparts: [
					{ id: "20", type: "HTTP", protocol: "HTTP", label: "HTTP-Ziel", basedOn: [] },
				],
			},
		],
	} as unknown as IAsset;
	const wizardAssets = [wizardFromAsset, wizardToAsset];

	it("neu erzeugter Link enthält LabelSnapshots auf Link- und Linkpart-Ebene", () => {
		const built = buildSingleLinkSnapshot(wizardAssets, {
			fromAssetId: "from",
			fromDockId: "dFrom",
			fromDockpartIds: ["2"],
			toAssetId: "to",
			toDockId: "dTo",
			toDockpartIds: ["20"],
		});
		const connection = ConnectionModel.create({
			id: "conn-test",
			definition: { label: "", description: "" },
			links: [
				{
					id: "1",
					title: "Neue Verbindung",
					fromComponentRef: built.fromComponentRef,
					fromDockRef: built.fromDockRef,
					fromLabelSnapshot: built.fromLabelSnapshot,
					toComponentRef: built.toComponentRef,
					toDockRef: built.toDockRef,
					toLabelSnapshot: built.toLabelSnapshot,
					direction: "DUAL",
					linkparts: built.linkparts,
					credentials: [],
					metadata: { status: "established", purpose: "", owner: "" },
				},
			],
			settings: {},
		});

		expect(connection.links[0].fromComponentRef).toBe("from");
		expect(connection.links[0].fromLabelSnapshot).toBe("From App");
		expect(connection.links[0].toLabelSnapshot).toBe("To App");
		expect(connection.links[0].linkparts[0].fromLabelSnapshot).toBe("HTTP");
		expect(connection.links[0].linkparts[0].toLabelSnapshot).toBe("HTTP-Ziel");
	});

	it("keine Extra-Daten für flache linkparts inkl. stackOrder (MST)", () => {
		const extras = findExtraPathsInScope(
			connectionInstance,
			linkpartsFieldItems,
			"links[0].linkparts[0]"
		);
		expect(extras).toEqual([]);
	});

	it("keine Extra-Daten für flache linkparts inkl. stackOrder (JSON)", () => {
		const extras = findExtraPathsInScope(
			instanceFixture,
			linkpartsFieldItems,
			"links[0].linkparts[0]"
		);
		expect(extras).toEqual([]);
	});

	it("keine Validierungsfehler für CONNECTION-Instanz gegen Beispiel-Schema", () => {
		expect(hasSchemaValidationErrorsInScope(instanceFixture, schemaItems, "")).toBe(false);
	});

	it("keine Validierungsfehler für MST-Connection gegen Beispiel-Schema", () => {
		expect(hasSchemaValidationErrorsInScope(connectionInstance, schemaItems, "")).toBe(false);
	});
});
