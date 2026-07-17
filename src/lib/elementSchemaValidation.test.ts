import { types } from "mobx-state-tree";
import { syncElementValidationStatus } from "./elementSchemaValidation";
import { hasElementValidationOrStoreErrors } from "./elementValidationChecks";
import { touchKindFromStatus } from "./elementStaging";
import { touchedObjectErrorRegistry } from "./touchedObjectErrors";

type TestElementStatus = "new" | "edit" | "changed" | "invalid" | "deleted" | "untouched";

const ValidationTestElement = types
	.model("ValidationTestElement", {
		id: types.identifier,
		definition: types.model({
			baseType: types.optional(types.string, ""),
		}),
	})
	.volatile(() => ({
		status: "untouched" as TestElementStatus,
		statusBeforeInvalid: null as TestElementStatus | null,
	}))
	.actions((self) => ({
		setStatus(status: TestElementStatus) {
			self.status = status;
		},
		syncValidationStatus() {
			const root = { configSchemas: { findSchemaByType: () => null } };
			if (self.status === "untouched") {
				return;
			}
			const hasErrors = hasElementValidationOrStoreErrors(root as any, self as any);

			if (hasErrors) {
				if (self.status === "deleted") {
					return;
				}
				if (self.status !== "invalid") {
					self.statusBeforeInvalid = self.status;
					self.status = "invalid";
				}
				return;
			}

			if (self.status === "invalid") {
				const restore = self.statusBeforeInvalid ?? "changed";
				self.statusBeforeInvalid = null;
				self.status = restore;
			}
		},
	}));

describe("syncElementValidationStatus", () => {
	afterEach(() => {
		touchedObjectErrorRegistry.clear("e1");
		touchedObjectErrorRegistry.clear("e2");
	});

	it("delegiert an element.syncValidationStatus()", () => {
		const element = ValidationTestElement.create({
			id: "e1",
			definition: { baseType: "" },
		});
		element.setStatus("changed");

		touchedObjectErrorRegistry.setFailure({
			ref: { id: "e1" } as any,
			request: { path: "/x", method: "PUT" } as any,
			message: "fail",
			isNetworkError: false,
		});

		syncElementValidationStatus({} as any, element as any);
		expect(element.status).toBe("invalid");
		expect(element.statusBeforeInvalid).toBe("changed");

		touchedObjectErrorRegistry.clear("e1");
		syncElementValidationStatus({} as any, element as any);
		expect(element.status).toBe("changed");
		expect(element.statusBeforeInvalid).toBeNull();
	});

	it("setzt auch bei Status new auf invalid", () => {
		const element = ValidationTestElement.create({
			id: "e2",
			definition: { baseType: "" },
		});
		element.setStatus("new");

		touchedObjectErrorRegistry.setFailure({
			ref: { id: "e2" } as any,
			request: { path: "/x", method: "POST" } as any,
			message: "fail",
			isNetworkError: false,
		});

		syncElementValidationStatus({} as any, element as any);
		expect(element.status).toBe("invalid");
		expect(element.statusBeforeInvalid).toBe("new");
		expect(touchKindFromStatus(element.status, element.statusBeforeInvalid)).toBe("create");
	});
});
