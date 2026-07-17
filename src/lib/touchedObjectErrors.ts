import { makeAutoObservable } from "mobx";
import { TouchedObjectRef } from "./touchedObjects";
import { TouchedObjectRestRequest } from "./restRequestForTouchedObject";

export interface TouchedObjectStoreFailure {
	ref: TouchedObjectRef;
	request: TouchedObjectRestRequest;
	status?: number;
	statusText?: string;
	message: string;
	responseBody?: string;
	responseHeaders?: Record<string, string>;
	isNetworkError?: boolean;
	cause?: unknown;
}

class TouchedObjectErrorRegistry {
	public failures = new Map<string, TouchedObjectStoreFailure>();

	constructor() {
		makeAutoObservable(this);
	}

	public setFailure(failure: TouchedObjectStoreFailure): void {
		this.failures.set(failure.ref.id, failure);
	}

	public clear(id: string): void {
		this.failures.delete(id);
	}

	public get(id: string): TouchedObjectStoreFailure | undefined {
		return this.failures.get(id);
	}

	public get all(): TouchedObjectStoreFailure[] {
		return Array.from(this.failures.values());
	}

	public clearAll(): void {
		this.failures.clear();
	}
}

export const touchedObjectErrorRegistry = new TouchedObjectErrorRegistry();
