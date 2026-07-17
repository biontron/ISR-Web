import { schemaItemUri, schemaListUri } from "./schemaRestUris";

describe("schemaRestUris", () => {
	it("maps list URIs per storeType", () => {
		expect(schemaListUri("demo", "INTERNAL")).toBe("/demo/config/schema/internals");
		expect(schemaListUri("demo", "COMPONENT")).toBe("/demo/config/schema/components");
		expect(schemaListUri("demo", "VIEWGROUP")).toBe("/demo/config/schema/viewgroups");
		expect(schemaListUri("demo", "DOCKPART")).toBe("/demo/config/schema/dockparts");
	});

	it("maps item URIs for GET PUT POST", () => {
		expect(schemaItemUri("demo", "COMPONENT", "HARDWARE")).toBe(
			"/demo/config/schema/components/HARDWARE"
		);
		expect(schemaItemUri("demo", "DOCKPART", "IPV4")).toBe(
			"/demo/config/schema/dockparts/IPV4"
		);
	});
});
