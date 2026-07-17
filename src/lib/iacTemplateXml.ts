export type ParsedIacTemplate = {
	id: string;
	format: string;
	mimeType: string;
	filename: string;
	version: string;
	xmldata?: string;
	texttemplate?: string;
	dataset?: {
		domain?: string;
		environment?: string;
		view?: string;
		group?: string;
		asset?: string;
	};
};

function requiredAttribute(element: Element, attributeName: string): string {
	const value = element.getAttribute(attributeName);
	if (value == null || value === "") {
		throw new Error(`Pflichtattribut '${attributeName}' fehlt in <iac-template>.`);
	}
	return value;
}

function optionalElementInnerXml(element: Element | null): string | undefined {
	if (!element) {
		return undefined;
	}
	const serializer = new XMLSerializer();
	const inner = Array.from(element.childNodes)
		.filter((node) => {
			if (node.nodeType === Node.TEXT_NODE) {
				return (node.textContent?.trim() ?? "") !== "";
			}
			return node.nodeType === Node.ELEMENT_NODE;
		})
		.map((node) => serializer.serializeToString(node).trim())
		.join("");
	return inner === "" ? undefined : inner;
}

function optionalElementText(element: Element | null): string | undefined {
	if (!element) {
		return undefined;
	}
	const text = element.textContent?.trim() ?? "";
	return text === "" ? undefined : text;
}

export function parseIacTemplateXml(xmlText: string): ParsedIacTemplate {
	const doc = new DOMParser().parseFromString(xmlText, "application/xml");
	const parseError = doc.querySelector("parsererror");
	if (parseError) {
		throw new Error(parseError.textContent?.trim() || "XML konnte nicht geparst werden.");
	}

	const root = doc.documentElement;

	if (root.localName.toLowerCase() !== "iac-template") {
		throw new Error(`Erwartetes Wurzelement <iac-template>, erhalten: <${root.localName}>.`);
	}

	const datasetEl = root.querySelector("dataset");

	return {
		id: requiredAttribute(root, "id"),
		format: requiredAttribute(root, "format"),
		mimeType: requiredAttribute(root, "mime-type"),
		filename: requiredAttribute(root, "filename"),
		version: requiredAttribute(root, "version"),
		xmldata: optionalElementInnerXml(root.querySelector("xmldata")),
		texttemplate: optionalElementText(root.querySelector("texttemplate")),

		// NEU:
		dataset: datasetEl ? {
			domain: optionalElementText(datasetEl.querySelector("domain")),
			environment: optionalElementText(datasetEl.querySelector("environment")),
			view: optionalElementText(datasetEl.querySelector("view")),
			group: optionalElementText(datasetEl.querySelector("group")),
			asset: optionalElementText(datasetEl.querySelector("asset")),
		} : undefined,
	};
}

export function validateIacTemplateXml(
	xmlText: string
): { ok: true } | { ok: false; message: string } {
	try {
		parseIacTemplateXml(xmlText);
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : String(error),
		};
	}
}
