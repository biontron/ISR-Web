import instanceFixtureJson from "../../Documents/examples/CONNECTION-instance.json";

type ConnectionInstanceFixture = {
	definition?: { label?: string };
	links: Array<{
		id: string;
		title?: string;
		fromComponentRef: string | null;
		toComponentRef: string | null;
		fromLabelSnapshot: string;
		toLabelSnapshot: string;
		fromDockRef: string;
		toDockRef: string;
		linkparts: Array<{
			fromDockpartRef: string;
			toDockpartRef: string;
			fromLabelSnapshot: string;
			toLabelSnapshot: string;
			stackOrder: number;
		}>;
	}>;
};

const instanceFixture = instanceFixtureJson as unknown as ConnectionInstanceFixture;

describe("CONNECTION-instance REST fixture", () => {
	it("hat flache links/linkparts-Struktur", () => {
		expect(instanceFixture.links).toHaveLength(3);
		expect(instanceFixture.links[0].fromDockRef).toBe("d123456789#1");
		expect(instanceFixture.links[0].toDockRef).toBe("d123456789#3");
		expect(instanceFixture.links[0].fromComponentRef).toBeTruthy();
		expect(instanceFixture.links[1].fromComponentRef).toBeNull();
		expect(instanceFixture.links[0].fromLabelSnapshot).toBe("aaa");
		expect(instanceFixture.links[0].title).toBeDefined();
		expect(instanceFixture.links[0].linkparts[0].fromDockpartRef).toBe("62");
		expect(instanceFixture.links[0].linkparts[0].fromLabelSnapshot).toBe("xxxx");
		expect(instanceFixtureJson).not.toHaveProperty("fromElement");
		expect(instanceFixture.definition?.label).toBe("Zigbee");
	});
});
