import { makeAutoObservable } from "mobx";

export type IaCTemplateWriteFailure = {
	templateKey: string;
	packageName: string;
	templateName: string;
	method: string;
	path: string;
	fullUrl: string;
	message: string;
	status?: number;
	statusText?: string;
	responseBody?: string;
	responseHeaders?: Record<string, string>;
	payload?: string;
};

class IaCWriteErrorRegistry {
	public failure: IaCTemplateWriteFailure | null = null;

	constructor() {
		makeAutoObservable(this);
	}

	public setFailure(failure: IaCTemplateWriteFailure): void {
		this.failure = failure;
	}

	public clear(): void {
		this.failure = null;
	}
}

export const iacWriteErrorRegistry = new IaCWriteErrorRegistry();

export function iacTemplateWriteKey(packageName: string, templateName: string): string {
	return `iac:${packageName}:${templateName}`;
}
