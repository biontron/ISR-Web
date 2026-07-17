export type IacTemplateUriOptions = {
	version?: string | null;
	run?: boolean;
};

function appendQuery(path: string, options?: IacTemplateUriOptions): string {
	if (!options?.version && !options?.run) {
		return path;
	}
	const params = new URLSearchParams();
	if (options.version) {
		params.set("version", options.version);
	}
	if (options.run) {
		params.set("run", "now");
	}
	return `${path}?${params.toString()}`;
}

export function iacPackagesListUri(domain: string): string {
	return `/${domain}/iac/packages`;
}

export function iacPackageItemUri(domain: string, packageId: string): string {
	return `/${domain}/iac/packages/${encodeURIComponent(packageId)}`;
}

export function iacTemplatesListUri(domain: string, packageId: string): string {
	return `/${domain}/iac/packages/${encodeURIComponent(packageId)}/templates`;
}

export function iacTemplateItemUri(
	domain: string,
	packageId: string,
	templateId: string,
	options?: Pick<IacTemplateUriOptions, "version">
): string {
	return appendQuery(
		`/${domain}/iac/packages/${encodeURIComponent(packageId)}/templates/${encodeURIComponent(templateId)}`,
		options
	);
}

export function iacTemplateRunUri(
	domain: string,
	packageId: string,
	templateId: string,
	options?: Pick<IacTemplateUriOptions, "version">
): string {
	return appendQuery(iacTemplateItemUri(domain, packageId, templateId), {
		...options,
		run: true,
	});
}
