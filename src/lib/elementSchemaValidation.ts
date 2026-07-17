import { IRootStore } from "../Stores/Root.Store";
import { IElement } from "../Stores/Models/Element.Model";

export {
	hasActiveElementSchemaValidationErrors,
	hasElementValidationOrStoreErrors,
} from "./elementValidationChecks";

/** Setzt element.status auf invalid bzw. stellt den vorherigen Status wieder her. */
export function syncElementValidationStatus(_root: IRootStore, element: IElement): void {
	element.syncValidationStatus();
}
