/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 
*/
import React, { useState } from "react";
import { Input, Button, Form, message, Card, Typography } from "antd";
import { SchemaField, SchemaGroup, SchemaTemplate } from "./Stores/Types/SchemaItem";

/* Testdata:
{
    "data": [
        {
            "MainId": 1111,
            "firstName": "Sherlock",
            "lastName": "Homes",
            "categories": [
                {
                    "CategoryID": 1,
                    "CategoryName": "Example"
                }
            ]
        },
        {
            "MainId": 122,
            "firstName": "James",
            "lastName": "Watson",
            "categories": [
                {
                    "CategoryID": 2,
                    "CategoryName": "Example2"
                }
            ]
        }
    ],
    "messages": [], // blank json
    "success": true // boolean value
}
*/


const { Text, Title } = Typography;

const Test: React.FC = () => {
	const [jsonInput, setJsonInput] = useState("");
	const [dynamicFormSchema, setDynamicFormSchema] = useState<any | null>(null);

	const convertJsonToDynamicFormSchema = (jsonData: any): SchemaTemplate => {
		const convertProperties = (properties: any): (SchemaField | SchemaGroup)[] => {
			return Object.keys(properties).map((propertyName, index) => {
				const propertyValue = properties[propertyName];

				if (typeof propertyValue === "object" && propertyValue !== null) {
					return {
						order: index + 1,
						dataStructure: {
							itemName: propertyName,
							default: "",
						},
						formProperties: {
							label: propertyName,
						},
						fieldType: "object",
						rules: "",
						example: "",
						flags: {},
						minUsage: 1,
						maxUsage: 1,
						items: convertProperties(propertyValue),
					};
				}

				return {
					order: index + 1,
					dataStructure: {
						itemName: propertyName,
						default: "",
					},
					formProperties: {
						label: propertyName,
					},
					fieldType: typeof propertyValue,
					rules: "",
					example: "",
					flags: {},
					minUsage: 1,
					maxUsage: 1,
				};
			});
		};

		const result: SchemaTemplate = {
			type: "dynamicForm", // Provide a suitable type
			name: "Dynamic Form", // Provide a suitable name
			order: 1, // Provide a suitable order value
			description: "Dynamic Form generated from JSON", // Provide a suitable description
			items: convertProperties(jsonData),
		};

		return result;
	};

	const handleJsonInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setJsonInput(e.target.value);
	};

	const handleConvertClick = () => {
		try {
			const jsonData = JSON.parse(jsonInput);
			const convertedSchema = convertJsonToDynamicFormSchema(jsonData);
			setDynamicFormSchema(convertedSchema);
		} catch (error) {
			message.error("Error parsing JSON or converting to Dynamic Form Schema");
		}
	};

	return (
		<Card title="JSON to Dynamic Form Converter" style={{ width: "500px", margin: "20px" }}>
			<Form>
				<Form.Item label="Paste JSON data">
					<Input.TextArea rows={8} value={jsonInput} onChange={handleJsonInputChange} />
				</Form.Item>
				<Form.Item>
					<Button type="primary" onClick={handleConvertClick}>
						Convert to Dynamic Form Schema
					</Button>
				</Form.Item>
			</Form>
			{dynamicFormSchema && (
				<div>
					<Title level={4}>Converted Dynamic Form Schema:</Title>
					<pre>{JSON.stringify(dynamicFormSchema, null, 2)}</pre>
				</div>
			)}
		</Card>
	);
};

export default Test;