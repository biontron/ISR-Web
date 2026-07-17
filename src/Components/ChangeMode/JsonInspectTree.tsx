import React from "react";
import { isJsonPathChanged } from "../../lib/jsonDiffPaths";

interface JsonInspectTreeProps {
	value: unknown;
	path: string;
	changedPaths: Set<string>;
	depth?: number;
}

function indent(depth: number): React.CSSProperties {
	return { paddingLeft: depth * 16 };
}

const JsonInspectTree: React.FC<JsonInspectTreeProps> = ({
	value,
	path,
	changedPaths,
	depth = 0,
}) => {
	const changed = isJsonPathChanged(path, changedPaths);

	if (value === null) {
		return (
			<div style={indent(depth)} className={changed ? "json-inspect-changed" : undefined}>
				<span className="json-inspect-null">null</span>
			</div>
		);
	}

	if (typeof value !== "object") {
		return (
			<div style={indent(depth)} className={changed ? "json-inspect-changed" : undefined}>
				<span className="json-inspect-primitive">{JSON.stringify(value)}</span>
			</div>
		);
	}

	if (Array.isArray(value)) {
		return (
			<div style={indent(depth)} className={changed ? "json-inspect-changed" : undefined}>
				<div className="json-inspect-bracket">[</div>
				{value.map((entry, index) => (
					<JsonInspectTree
						key={`${path}[${index}]`}
						value={entry}
						path={path ? `${path}[${index}]` : `[${index}]`}
						changedPaths={changedPaths}
						depth={depth + 1}
					/>
				))}
				<div style={indent(depth + 1)} className="json-inspect-bracket">]</div>
			</div>
		);
	}

	const entries = Object.entries(value as Record<string, unknown>);
	return (
		<div style={indent(depth)} className={changed ? "json-inspect-changed" : undefined}>
			<div className="json-inspect-bracket">{"{"}</div>
			{entries.map(([key, entryValue]) => {
				const childPath = path ? `${path}.${key}` : key;
				const keyChanged = isJsonPathChanged(childPath, changedPaths);
				return (
					<div key={childPath} style={indent(depth + 1)}>
						<span className={keyChanged ? "json-inspect-key json-inspect-changed" : "json-inspect-key"}>
							{JSON.stringify(key)}:
						</span>{" "}
						{typeof entryValue === "object" && entryValue !== null ? (
							<JsonInspectTree
								value={entryValue}
								path={childPath}
								changedPaths={changedPaths}
								depth={depth + 1}
							/>
						) : (
							<span className={keyChanged ? "json-inspect-changed" : undefined}>
								{entryValue === null ? "null" : JSON.stringify(entryValue)}
							</span>
						)}
					</div>
				);
			})}
			<div style={indent(depth + 1)} className="json-inspect-bracket">{"}"}</div>
		</div>
	);
};

export default JsonInspectTree;
