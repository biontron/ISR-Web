export type CreateTabKey = "structure" | "component";

/** Ohne Strukturbaum-Schemas den Komponenten-Reiter vorauswählen. */
export function resolveCreateDialogTab(structureCount: number): CreateTabKey {
	return structureCount > 0 ? "structure" : "component";
}
