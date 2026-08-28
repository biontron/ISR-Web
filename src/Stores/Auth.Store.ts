/*
# SPDX-License-Identifier: GPL-2.0*/

import { observable, action, makeObservable, runInAction } from "mobx";
import { rootStore } from "./Root.Store";
import api from "../lib/api";
import {
	formatLoginFailureMessage,
	isLoginNetworkFailure,
	loginFailureFromNetwork,
} from "../lib/loginAttempt";

export type LoginMessageType = "success" | "error";

export class AuthStore {
	public isAuthenticated: boolean = false;
	public domain: string | undefined = undefined;
	public lang: string = "en";
	public knownDomains: string[] = [];
	public shouldRemember: boolean = true;
	public username: string | undefined = undefined;
	public lastMessage = "";
	public lastMessageType: LoginMessageType | undefined = undefined;

	constructor() {
		makeObservable(this, {
			isAuthenticated: observable,
			domain: observable,
			lang: observable,
			knownDomains: observable,
			shouldRemember: observable,
			username: observable,
			lastMessage: observable,
			lastMessageType: observable,
			login: action,
			logout: action,
			setDomain: action,
			setShouldRemember: action,
		});
		this.loadFromLocalStorage();
	}

	/**
	 * load state from localStorage
	 */
	private loadFromLocalStorage() {
		const shouldRemember = localStorage.getItem("shouldRemember") !== "false";
		this.shouldRemember = shouldRemember;

		if (!shouldRemember) {
			return;
		}

		const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
		const domain = localStorage.getItem("domain");
		const lang = localStorage.getItem("lang");
		const storedDomains = localStorage.getItem("knownDomains");
		const username = localStorage.getItem("username");

		if (domain && lang) {
			this.isAuthenticated = isAuthenticated;
			this.domain = domain === "" ? undefined : domain;
			this.lang = lang;
		}

		if (username) {
			this.username = username;
		}

		if (storedDomains) {
			try {
				const domains = JSON.parse(storedDomains);
				if (Array.isArray(domains)) {
					this.knownDomains = domains;
				}
			} catch (error) {
				console.error("Fehler beim Laden der bekannten Domains:", error);
			}
		}
	}

	/**
	 * save state to localStorage
	 */
	private saveToLocalStorage() {
		if (!this.shouldRemember) {
			this.clearLocalStorage();
			return;
		}

		localStorage.setItem("shouldRemember", this.shouldRemember.toString());
		localStorage.setItem("isAuthenticated", this.isAuthenticated.toString());
		localStorage.setItem("domain", this.domain ?? "");
		localStorage.setItem("lang", this.lang);
		localStorage.setItem("knownDomains", JSON.stringify(this.knownDomains));
		localStorage.setItem("username", this.username ?? "");
	}

	/**
	 * delete state at localStorage
	 */
	private clearLocalStorage() {
		localStorage.removeItem("shouldRemember");
		localStorage.removeItem("isAuthenticated");
		localStorage.removeItem("domain");
		localStorage.removeItem("lang");
		localStorage.removeItem("knownDomains");
		localStorage.removeItem("username");
	}

	public setShouldRemember(value: boolean) {
		this.shouldRemember = value;
		if (!value) {
			this.clearLocalStorage();
		} else {
			this.saveToLocalStorage();
		}
	}

	private setLoginMessage(message: string, type: LoginMessageType | undefined) {
		this.lastMessage = message;
		this.lastMessageType = type;
	}

	/**
	 * Anmeldung mit Benutzername und Passwort und Generierung eines JWT
	 */
	public async login(username: string, password: string, domain: string) {
		this.setLoginMessage("", undefined);

		try {
			const result = await api.login(username, password, domain);

			runInAction(() => {
				if (result.ok) {
					this.isAuthenticated = true;
					this.username = username;
					this.setDomain(domain);
					this.setLoginMessage(rootStore.i18n.text("general.login_success"), "success");
					this.saveToLocalStorage();
					return;
				}

				this.setLoginMessage(
					formatLoginFailureMessage(result, (key) => rootStore.i18n.text(key)),
					"error"
				);
			});
		} catch (error) {
			console.error("Login failed:", error);
			runInAction(() => {
				const failure = isLoginNetworkFailure(error)
					? loginFailureFromNetwork(error)
					: {
							ok: false as const,
							kind: "server" as const,
							detail: error instanceof Error ? error.message : String(error),
					  };
				this.setLoginMessage(
					formatLoginFailureMessage(failure, (key) => rootStore.i18n.text(key)),
					"error"
				);
			});
		}
	}

	/**
	 * Abmeldung und Löschen des JWT
	 */
	public logout = async () => {
		try {
			const logoutResponse = await api.logout();
			if (logoutResponse) {
				this.isAuthenticated = false;
				this.setLoginMessage("", undefined);
				this.username = undefined;
				this.clearLocalStorage();
			} else {
				throw new Error("Abmeldung fehlgeschlagen");
			}
		} catch (error) {
			console.error("Abmeldung fehlgeschlagen:", error);
			throw error;
		}
	};

	public getLastMessage() {
		return this.lastMessage;
	}

	public isLoggedIn() {
		return this.isAuthenticated;
	}

	public getDomain() {
		return this.domain;
	}

	/**
	 * Setzt die aktuelle Domain und fügt sie zur Liste der bekannten Domains hinzu
	 */
	public setDomain(domain: string) {
		this.domain = domain;
		if (!this.knownDomains.includes(domain)) {
			this.knownDomains.push(domain);
		}
		this.saveToLocalStorage();
	}
}

const authStore = new AuthStore();

export default authStore;
