import { makeAutoObservable } from "mobx";

export type ActivityStatusOverviewTab = "read" | "write";

export type ActivityStatusOverviewShowOptions = {
	unsavedHint?: boolean;
};

class ActivityStatusOverviewUi {
	public open = false;
	public initialTab: ActivityStatusOverviewTab = "write";
	public showUnsavedHint = false;

	constructor() {
		makeAutoObservable(this);
	}

	public show(
		tab: ActivityStatusOverviewTab = "write",
		options: ActivityStatusOverviewShowOptions = {}
	): void {
		this.initialTab = tab;
		this.showUnsavedHint = options.unsavedHint ?? false;
		this.open = true;
	}

	public close(): void {
		this.open = false;
		this.showUnsavedHint = false;
	}
}

export const activityStatusOverviewUi = new ActivityStatusOverviewUi();
