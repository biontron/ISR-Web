import "../../../Stores/Root.Store";
import { fireEvent, render, screen } from "@testing-library/react";
import { rootStore } from "../../../Stores/Root.Store";
import CreateSchemaDialog from "./CreateSchemaDialog.Component";

beforeAll(async () => {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => undefined,
			removeListener: () => undefined,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
			dispatchEvent: () => false,
		}),
	});
	await rootStore.i18n.loadBundle();
});

describe("CreateSchemaDialog", () => {
	it("erzeugt aus eingefügtem JSON die Schema-Vorschau", async () => {
		render(
			<CreateSchemaDialog
				open
				baseType="COMPONENT"
				onClose={() => undefined}
				onCreated={() => undefined}
			/>
		);

		const sample = screen.getByPlaceholderText('{ "name": "web01", "port": 443 }');
		fireEvent.change(sample, {
			target: {
				value: '{"id":"web-01","port":443,"tags":["prod"]}',
			},
		});
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		expect(await screen.findByDisplayValue("WEB-01")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

		expect(await screen.findByText(/JSON erkannt, 4 Einträge für Schema WEB-01/)).toBeInTheDocument();
		expect(screen.getByText("port · number · 443")).toBeInTheDocument();
		expect(screen.getByText("tags · Liste")).toBeInTheDocument();
		expect(screen.getByText("value · string · prod")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Zur Aktivitätsübersicht" })).toBeInTheDocument();
	});
});
