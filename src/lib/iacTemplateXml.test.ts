import { parseIacTemplateXml, validateIacTemplateXml } from "./iacTemplateXml";

const SAMPLE_XML = `<iac-template format="yaml" mime-type="application/yaml" filename="test1.yaml" id="test1" version="1.0.0">
    <xmldata>
        <name>Schneider</name>
        <salary amount="3700"/>
    </xmldata>
    <texttemplate>Dear Mr. [//name], we have seen that your salary is that high: [//salary/@amount] EUR.</texttemplate>
</iac-template>`;

describe("parseIacTemplateXml", () => {
	it("liest Attribute und Inhalte aus iac-template", () => {
		const parsed = parseIacTemplateXml(SAMPLE_XML);

		expect(parsed).toEqual({
			id: "test1",
			format: "yaml",
			mimeType: "application/yaml",
			filename: "test1.yaml",
			version: "1.0.0",
			xmldata: "<name>Schneider</name><salary amount=\"3700\"/>",
			texttemplate:
				"Dear Mr. [//name], we have seen that your salary is that high: [//salary/@amount] EUR.",
		});
	});

	it("meldet fehlende Pflichtattribute", () => {
		expect(() => parseIacTemplateXml("<iac-template id=\"x\"/>")).toThrow(
			"Pflichtattribut 'format'"
		);
	});

	it("validateIacTemplateXml", () => {
		expect(validateIacTemplateXml(SAMPLE_XML)).toEqual({ ok: true });
		expect(validateIacTemplateXml("<bad/>")).toEqual({
			ok: false,
			message: expect.stringContaining("iac-template"),
		});
	});
});
