import { Instance, types } from "mobx-state-tree";
import ElementModel from "./Element.Model";

export const ConnectionDefinitionModel = types.model("ConnectionDefinition", {
	label: types.optional(types.string, ""),
	description: types.optional(types.string, ""),
});

export const LinkpartModel = types.model("Linkpart", {
	fromLabelSnapshot: types.optional(types.string, ""),
	toLabelSnapshot: types.optional(types.string, ""),
	fromDockpartRef: types.optional(types.string, ""),
	toDockpartRef: types.optional(types.string, ""),
	stackOrder: types.optional(types.number, 0),
});

export const LinkMetadataModel = types.model("LinkMetadata", {
	status: types.optional(types.string, "established"),
	purpose: types.optional(types.string, ""),
	owner: types.optional(types.string, ""),
});

export const LinkModel = types.model("Link", {
	id: types.string,
	title: types.optional(types.string, ""),
	fromComponentRef: types.maybeNull(types.string),
	fromDockRef: types.optional(types.string, ""),
	fromLabelSnapshot: types.optional(types.string, ""),
	toComponentRef: types.maybeNull(types.string),
	toDockRef: types.optional(types.string, ""),
	toLabelSnapshot: types.optional(types.string, ""),
	direction: types.optional(types.string, "DUAL"),
	linkparts: types.optional(types.array(LinkpartModel), []),
	credentials: types.optional(types.array(types.frozen()), []),
	metadata: types.optional(LinkMetadataModel, {}),
});

export const ConnectionModel = types.compose(
	ElementModel,
	types
		.model("Connection", {
			id: types.identifier,
			definition: types.optional(ConnectionDefinitionModel, {}),
			links: types.optional(types.array(LinkModel), []),
			settings: types.optional(types.map(types.frozen()), {}),
		})
		.views((self) => ({
			get class(): string {
				return "Connection";
			},
		}))
);

export type ILinkpart = Instance<typeof LinkpartModel>;
export type ILink = Instance<typeof LinkModel>;
export type IConnection = Instance<typeof ConnectionModel>;

export function getConnectionDisplayName(connection: IConnection): string {
	const label = connection.definition?.label?.trim();
	if (label) {
		return label;
	}
	const linkTitle = connection.links[0]?.title?.trim();
	if (linkTitle) {
		return linkTitle;
	}
	return connection.id;
}
