export const GRAPH_MAX_TREE_NODES = 500;
export const GRAPH_MAX_TREE_DEPTH = 10;

/** Walk-Tiefe; die Knotenanzahl begrenzt GRAPH_MAX_TREE_NODES (View-Folder zuerst, dann Components). */
export function resolveGraphTreeDepth(requested: number): number {
	return Math.min(Math.max(0, requested), GRAPH_MAX_TREE_DEPTH);
}
