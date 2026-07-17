/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import React from "react";

export type ITreeNode = {
	key: string;
	title: string | React.ReactNode;
	baseType: string | undefined;
	subType: string | undefined;
	storeType?: string;
	elementType?: string;
	children?: ITreeNode[];
	disabled?: boolean;
	selectable?: boolean;
	/* transfer data */
	class: string | undefined;
	label?: string;
	description: string | undefined;
	status: string | undefined;
};