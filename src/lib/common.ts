import { rootStore } from "../Stores/Root.Store";
import { isObservableMap } from "mobx";
import { IMultilingualText } from "../Stores/Types/MultilingualText";

/**
 * Provide the language specific text
 * @param languageTexts multi-language text array
 * @param lang the wanted language code (default is taken fror i18n.lang)
 * @returns the language text for the given language or the unspecific language code "und" (ISO 639-3) is been used
 */
function resolvePlainLanguageRecord(
	record: Record<string, unknown>,
	lang: string
): string {
	const langText = record[lang];
	if (typeof langText === "string") {
		return langText;
	}
	const undText = record.und;
	if (typeof undText === "string") {
		return undText;
	}
	const first = Object.values(record).find((entry) => typeof entry === "string");
	return typeof first === "string" ? first : "";
}

export function getLanguageText (
	languageTexts: IMultilingualText | Record<string, unknown> | null | undefined,
	lang: string = rootStore.i18n.lang): string {
	if (languageTexts == null) {
		return "";
	}
	if (isMultilingualTextValue(languageTexts)) {
		return languageTexts.get(lang) || languageTexts.get("und") || "";
	}
	if (typeof languageTexts === "object" && !Array.isArray(languageTexts)) {
		return resolvePlainLanguageRecord(languageTexts, lang);
	}
	return "";
} // Union für Felder und Gruppen

export function isMultilingualTextValue(value: unknown): value is IMultilingualText {
	if (value == null || typeof value !== "object") {
		return false;
	}
	if (isObservableMap(value)) {
		return true;
	}
	return typeof (value as { get?: unknown }).get === "function";
}

/** Anzeigewert für SchemaEditor-Felder (MultilingualText, JSON, Skalar). */
export function formatSchemaFieldDisplayValue(
	value: unknown,
	fieldType: string,
	lang: string = rootStore.i18n.lang
): string {
	if (value === null || value === undefined) {
		return "";
	}
	if (isMultilingualTextValue(value)) {
		return getLanguageText(value, lang);
	}
	if (typeof value === "object" && !Array.isArray(value)) {
		const record = value as Record<string, unknown>;
		if (
			typeof record[lang] === "string" ||
			typeof record.und === "string" ||
			Object.values(record).some((entry) => typeof entry === "string")
		) {
			return resolvePlainLanguageRecord(record, lang);
		}
		if (fieldType === "object" || fieldType === "array") {
			try {
				return JSON.stringify(value);
			} catch {
				return String(value);
			}
		}
	}
	return String(value);
}

/**
 * Convenience function to get the langtext function from the i18n store.
 *
 * @export
 * @returns {*}
 */
export function useLangtext () {
	const i18n = rootStore.i18n;
	return i18n.text;
}

import { generateResourceId } from "./resourceId";

/**
 * Generates a resource id: [VGADCE]-[A-Za-z0-9]{22} (lossless UUID v4 in Base62).
 * Not used for element schema resources (semantic schema ids).
 */
export function generateResourceID(resourceType: string): string {
	return generateResourceId(resourceType);
}