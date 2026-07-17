import get from "lodash.get";
import { reaction } from "mobx";
import { Instance, flow, types } from "mobx-state-tree";

/**
 * This is the i18n store. It holds all the translations for the app.
 * We will support dynamic loading of translation files as well as string interpolation.
 * This is a mobX state tree adaption of the original care i18n store.
 */
export const I18NStoreModel = types.model("I18NStore", {
	availableLanguages: types.optional(types.array(types.string), ["de", "en"]),
	lang: types.optional(types.string, "de"),
	bundle: types.optional(types.map(types.frozen()), {})
}).actions(self => {
	/**
	 * set the language (as a two digits value)
	 */
	function setLanguage (lang: string) {
		self.lang = lang.substr(0, 2);
	}

	/**
	 * This is called after the store is created. It will load the language bundle for the current language.
	 * It will also react to changes in the language and load the new bundle.
	 */
	function afterAttach () {
		loadBundle();
		reaction(() => self.lang, lang => {
			console.log("Language changed to: ", lang);
			loadBundle();
		});
	}


	/**
	 * Dynamic import of the language bundle based on the language.
	 * This will import a json file with the translations for the given language.
	 */
	const loadBundle = flow(function* () {
		// We will load the general bundle and then all of the bundles for the language enabled apps of the app store
		try {
			// The general bundle is always loaded - no matter what language is selected or what apps are enabled for i18n
			const bundle = yield import(`../i18n/${self.lang}.json`);
			Object.entries(bundle.default ?? {}).forEach(([key, value]) => {
				self.bundle.set(key, value);
			});
		} catch (e) {
			console.log("Error loading bundle: ", e);
			// TODO: Error handling
		}
	});

	return {
		setLanguage,
		afterAttach,
		loadBundle
	};
}).views(self => ({
	text(key: string, values: Array<string|number>|{[key: string]: string|number} = {}) {
		const identifier = key.split(".");
		const bundle = self.bundle.get(identifier[0] ?? "general");
		const langkey = identifier.slice(1).join(".");
		const placeholderRegex = /%[%sd]/g;
		let str: string = get(bundle, langkey); // this.bundle[key];
		if (typeof str !== "string") return `EI18NKEY: ${langkey} `;

		// handling a simple array of value sreplacing the "%s" placeholders in the text
		if (Array.isArray(values)) {
			let i = 0;
			return str.replace(placeholderRegex, function(match) {
				if (i === values.length) return "EI18NVAL";
				switch (match) {
					case "%%":
						return "%";
					case "%s":
					case "%d": // TODO decimals formatting
						return String(values[i++]);
					default:
						return match;
				}
			});
		} else if (typeof values === "object" && values != null) {
			Object.keys(values).forEach((key) => str = str.replace(RegExp(`\\@\\@${key}\\@\\@`, "gi"), values[key] as string) );
			return str;
		}

		// default return if none of the above applies to the values passed in
		return str;

	}
}));

// Typescript export
export interface II18NStoreModel extends Instance<typeof I18NStoreModel> {}