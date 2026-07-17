import { ElementStatus } from "../Stores/Models/Element.Model";

export function elementStatusShowsIndicator(status?: ElementStatus): boolean {
	return !!status && status !== "untouched";
}

export function buildElementStatusClass(
	baseClass: string,
	status?: ElementStatus
): string {
	if (!elementStatusShowsIndicator(status)) {
		return baseClass;
	}
	return `${baseClass} ${baseClass}--${status}`;
}
