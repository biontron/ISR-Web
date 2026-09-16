import { getSnapshot } from "mobx-state-tree";
import { UserSettingsModel } from "./UserSettings.Model";

describe("UserSettingsModel", () => {
	it("roundtrips the REST snapshot", () => {
		const snapshot = {
			id: "1",
			name: "Mr. X",
			publicKey: "-----BEGIN PUBLIC KEY-----\nABC\n-----END PUBLIC KEY-----\n",
			privateKey: "-----BEGIN PRIVATE KEY-----\nDEF\n-----END PRIVATE KEY-----\n",
		};
		const model = UserSettingsModel.create(snapshot);
		expect(getSnapshot(model)).toEqual(snapshot);
	});
});
