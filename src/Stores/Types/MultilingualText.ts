import { Instance, types } from "mobx-state-tree";

/**
 * Definition eines Texteintrags in einer Sprache
 */
export const MultilingualText = types.map(types.string);
export type IMultilingualText = Instance<typeof MultilingualText>;