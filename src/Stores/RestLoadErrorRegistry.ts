import { makeAutoObservable } from "mobx";
import type { RestLoadErrorEntry, RestLoadRequestMeta, RestObjectKind } from "../lib/restSnapshot";

export type RestLoadReport = {
	objectKind: RestObjectKind;
	domain?: string;
	responseFormat?: string;
	restCount: number;
	loadedCount: number;
	restIds: string[];
	loadedIds: string[];
	errors: RestLoadErrorEntry[];
	loadedAt: string;
	request?: RestLoadRequestMeta;
};

class RestLoadErrorRegistry {
	public errorsBySource: Partial<Record<RestObjectKind, RestLoadErrorEntry[]>> = {};
	public reportsBySource: Partial<Record<RestObjectKind, RestLoadReport>> = {};

	constructor() {
		makeAutoObservable(this);
	}

	public setLoadResult(source: RestObjectKind, report: RestLoadReport): void {
		this.reportsBySource = {
			...this.reportsBySource,
			[source]: report,
		};
		this.errorsBySource = {
			...this.errorsBySource,
			[source]: [...report.errors],
		};

		console.info(
			`[REST→MobX ${source}] domain=${report.domain ?? "?"} format=${report.responseFormat ?? "?"} ` +
				`REST=${report.restCount} (${report.restIds.join(", ")}) → ` +
				`Store=${report.loadedCount} (${report.loadedIds.join(", ")})` +
				(report.errors.length ? ` | FEHLER=${report.errors.length}` : "")
		);

		if (report.errors.length > 0) {
			console.error(
				`REST-Ladefehler (${source}): ${report.errors.length} Objekt(e) konnten nicht nach MobX geladen werden.`,
				report.errors
			);
		}
	}

	public getErrors(source: RestObjectKind): RestLoadErrorEntry[] {
		return this.errorsBySource[source] ?? [];
	}

	public getReport(source: RestObjectKind): RestLoadReport | undefined {
		return this.reportsBySource[source];
	}

	public get allErrors(): RestLoadErrorEntry[] {
		return Object.values(this.errorsBySource).flatMap((errors) => errors ?? []);
	}
}

export const restLoadErrorRegistry = new RestLoadErrorRegistry();
