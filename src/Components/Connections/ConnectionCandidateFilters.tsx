import React from "react";
import { Input, Select, Space } from "antd";
import { ConnectionCandidateFilters as FilterState } from "../../lib/connectionCandidateFilter";

type ConnectionCandidateFiltersProps = {
	filters: FilterState;
	elementTypeOptions: string[];
	subTypeOptions: string[];
	protocolOptions: string[];
	onChange: (next: FilterState) => void;
};

const ConnectionCandidateFiltersBar: React.FC<ConnectionCandidateFiltersProps> = ({
	filters,
	elementTypeOptions,
	subTypeOptions,
	protocolOptions,
	onChange,
}) => {
	return (
		<div className="connection-selection-filters">
			<Space wrap size="middle">
				<Input.Search
					placeholder="Kandidat suchen…"
					value={filters.searchText ?? ""}
					onChange={(event) => onChange({ ...filters, searchText: event.target.value })}
					allowClear
					style={{ minWidth: 200 }}
				/>
				<Select
					allowClear
					placeholder="Typ"
					value={filters.elementType}
					onChange={(value) =>
						onChange({ ...filters, elementType: value, subType: undefined })
					}
					options={elementTypeOptions.map((value) => ({ value, label: value }))}
					style={{ minWidth: 140 }}
				/>
				<Select
					allowClear
					placeholder="Schema"
					value={filters.subType}
					disabled={!filters.elementType && subTypeOptions.length === 0}
					onChange={(value) => onChange({ ...filters, subType: value })}
					options={subTypeOptions.map((value) => ({ value, label: value }))}
					style={{ minWidth: 140 }}
				/>
				<Select
					allowClear
					placeholder="Protokoll"
					value={filters.protocol}
					onChange={(value) => onChange({ ...filters, protocol: value })}
					options={protocolOptions.map((value) => ({ value, label: value }))}
					style={{ minWidth: 140 }}
				/>
			</Space>
		</div>
	);
};

export default ConnectionCandidateFiltersBar;
