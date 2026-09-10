import type { ElementMarkFlags } from "./elementXPathValidation";

export type SignalBarFlags = Pick<ElementMarkFlags, "changed" | "positive" | "negative">;

export function buildElementSignalBarsClassName(
	orientation: "vertical" | "horizontal"
): string {
	return `element-signal-bars element-signal-bars--${orientation}`;
}

export function buildElementSignalBarsHtml(
	flags: SignalBarFlags | undefined,
	orientation: "vertical" | "horizontal"
): string {
	const changed = flags?.changed ? "is-on" : "is-off";
	const positive = flags?.positive ? "is-on" : "is-off";
	const negative = flags?.negative ? "is-on" : "is-off";
	return `<span class="${buildElementSignalBarsClassName(orientation)}" aria-hidden="true"><span class="element-signal-bars__seg element-signal-bars__seg--changed ${changed}"></span><span class="element-signal-bars__seg element-signal-bars__seg--positive ${positive}"></span><span class="element-signal-bars__seg element-signal-bars__seg--negative ${negative}"></span></span>`;
}
