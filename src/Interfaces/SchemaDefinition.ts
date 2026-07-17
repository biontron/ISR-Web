import { ISchemaItem } from "../Stores/Types/SchemaItem";
import { IConnectSchemaItem } from "../Stores/Types/ConnectSchemaItem";
import { SchemaBaseType } from "../lib/schemaDomain";

/** Gemeinsame Schema-Struktur für Editor- und Dockpart-Schemata. */
export interface ISchemaDefinition {
	id: string;
	type: string;
	baseType?: SchemaBaseType;
	items: ISchemaItem[] | IConnectSchemaItem[];
}
