/*
# SPDX-License-Identifier: GPL-2.0
*/

import { IAsset } from "../Stores/Models/Asset.Model";
import { IDock, IDockpart } from "../Stores/Models/Dock.Model";

export type EffectiveDockpart = Pick<IDockpart, "id" | "type" | "label"> & {
	isInherited?: boolean;
	inheritedFromContextRef?: string;
	inheritedFromDockpartRef?: string;
	inheritedContextLabelSnapshot?: string;
	isOverridden?: boolean;
};

export type EffectiveDock = Pick<IDock, "id" | "type" | "label"> & {
	dockparts: EffectiveDockpart[];
	ownerType?: string;
	ownerRef?: string;
};

export type GraphContextMembership = {
	contextRef: string;
	contextLabelSnapshot?: string;
};

export type GraphContext = {
	id: string;
	docks: Array<Pick<IDock, "id" | "type" | "label"> & {
		dockparts: Array<Pick<IDockpart, "id" | "type" | "label">>;
	}>;
};

export type GraphComponent = Pick<IAsset, "id"> & {
	docks: Array<Pick<IDock, "id" | "type" | "label"> & {
		dockparts: Array<Pick<IDockpart, "id" | "type" | "label">>;
	}>;
	contextMemberships?: GraphContextMembership[];
};

/**
 * Liefert die effektiven Docks einer Component inklusive geerbter Dockparts aus Contexts.
 * Diese Funktion arbeitet rein clientseitig.
 */
export function getEffectiveDocks(
	component: GraphComponent,
	allContexts: GraphContext[]
): EffectiveDock[] {
	const contextMap = new Map(allContexts.map((context) => [context.id, context]));
	const effectiveDocks: EffectiveDock[] = component.docks.map((dock) => ({
		id: dock.id,
		type: dock.type,
		label: dock.label,
		dockparts: dock.dockparts.map((part) => ({
			id: part.id,
			type: part.type,
			label: part.label,
		})),
	}));

	for (const membership of component.contextMemberships ?? []) {
		const context = contextMap.get(membership.contextRef);
		if (!context) continue;

		for (const contextDock of context.docks) {
			for (const contextDockpart of contextDock.dockparts) {
				const inheritedPart: EffectiveDockpart = {
					...contextDockpart,
					isInherited: true,
					inheritedFromContextRef: context.id,
					inheritedFromDockpartRef: contextDockpart.id,
					inheritedContextLabelSnapshot: membership.contextLabelSnapshot,
					isOverridden: false,
				};

				let targetDock = effectiveDocks.find((dock) => dock.type === contextDock.type);

				if (!targetDock) {
					targetDock = {
						id: `inherited-${contextDock.id}`,
						type: contextDock.type,
						label: contextDock.label,
						dockparts: [],
						ownerType: "COMPONENT",
						ownerRef: component.id,
					};
					effectiveDocks.push(targetDock);
				}

				targetDock.dockparts.push(inheritedPart);
			}
		}
	}

	return effectiveDocks;
}

/** Prüft, ob ein Dockpart geerbt ist */
export function isInheritedDockpart(dockpart: EffectiveDockpart): boolean {
	return !!dockpart.isInherited;
}

/** Erzeugt eine kurze Beschreibung eines Dockparts (für Labels) */
export function formatDockpartLabel(dockpart: EffectiveDockpart): string {
	const inherited = dockpart.isInherited
		? ` (geerbt aus ${dockpart.inheritedContextLabelSnapshot ?? "Context"})`
		: "";
	return `${dockpart.label}${inherited}`;
}
