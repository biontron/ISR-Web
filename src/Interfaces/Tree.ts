/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import React from "react";

export type ITreeNode = {
	key: string;
	/** REST-Element-ID — kann mehrfach im Baum vorkommen; `key` ist die eindeutige Knoten-ID. */
	elementId?: string;
	title: string | React.ReactNode;
	baseType: string | undefined;
	subType: string | undefined;
	storeType?: string;
	elementType?: string;
	children?: ITreeNode[];
	isLeaf?: boolean;
	disabled?: boolean;
	selectable?: boolean;
	/* transfer data */
	class: string | undefined;
	label?: string;
	description: string | undefined;
	status: string | undefined;
	validationPositive?: boolean;
	validationNegative?: boolean;
	searchMatch?: boolean;
};