export {
	collectTouchedObjects,
	collectTouchedObjects as collectPendingElements,
	hasTouchedObjects,
	hasTouchedObjects as hasPendingElementChanges,
	undoTouchedObject,
	discardSelectedTouchedObjects,
	type TouchedObjectRef,
	type TouchedObjectRef as PendingElementRef,
	type TouchedObjectKind,
	type TouchedObjectKind as PendingElementClass,
} from "./touchedObjects";
