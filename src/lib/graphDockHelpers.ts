import { IComponent, IContext, IDock, IDockpart } from "../../Stores/Types/Element"; // Passe den Import-Pfad ggf. an

/**
 * Liefert die effektiven Docks einer Component inklusive geerbter Dockparts aus Contexts.
 * Diese Funktion arbeitet rein clientseitig.
 */
export function getEffectiveDocks(
  component: IComponent,
  allContexts: IContext[]
): IDock[] {
  const contextMap = new Map(allContexts.map((c) => [c.id, c]));
  const effectiveDocks: IDock[] = component.docks.map((dock) => ({
    ...dock,
    dockparts: dock.dockparts.map((part) => ({ ...part })),
  }));

  for (const membership of component.contextMemberships) {
    const context = contextMap.get(membership.contextRef);
    if (!context) continue;

    for (const contextDock of context.docks) {
      for (const contextDockpart of contextDock.dockparts) {
        const inheritedPart: IDockpart = {
          ...contextDockpart,
          isInherited: true,
          inheritedFromContextRef: context.id,
          inheritedFromDockpartRef: contextDockpart.id,
          inheritedContextLabelSnapshot: membership.contextLabelSnapshot,
          isOverridden: false,
        };

        // Versuche, ein passendes Dock in der Component zu finden
        let targetDock = effectiveDocks.find((d) => d.type === contextDock.type);

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
export function isInheritedDockpart(dockpart: IDockpart): boolean {
  return !!dockpart.isInherited;
}

/** Erzeugt eine kurze Beschreibung eines Dockparts (für Labels) */
export function formatDockpartLabel(dockpart: IDockpart): string {
  const inherited = dockpart.isInherited
    ? ` (geerbt aus ${dockpart.inheritedContextLabelSnapshot ?? "Context"})`
    : "";
  return `${dockpart.label}${inherited}`;
}