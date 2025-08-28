import React from 'react';
import { JsonSchemaProperty } from '@/lib/policy-engine/types/core';

export interface SchemaDisplayFieldProps {
  name: string;
  schema: JsonSchemaProperty;
  value: any;
  required?: boolean;
}

export function SchemaDisplayField({ name, schema, value, required }: SchemaDisplayFieldProps) {
  const renderValue = () => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">Not set</span>;
    }

    switch (schema.type) {
      case 'string':
        if (schema.enum) {
          return <span className="font-medium">{schema.enumLabels?.[value] || value}</span>;
        }
        if (schema.format === 'multiline') {
          return (
            <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-2 rounded border">
              {value}
            </pre>
          );
        }
        return <span className="font-medium">{value}</span>;
        
      case 'number':
        return <span className="font-medium">{value}</span>;
        
      case 'boolean':
        return (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {value ? 'Yes' : 'No'}
          </span>
        );
        
      case 'array':
        if (value.length === 0) {
          return <span className="text-gray-400 italic">Empty array</span>;
        }
        return (
          <ArrayDisplay
            value={value}
            itemSchema={schema.items!}
          />
        );
        
      case 'object':
        if (Object.keys(value).length === 0) {
          return <span className="text-gray-400 italic">Empty object</span>;
        }
        return (
          <ObjectDisplay
            value={value}
            properties={schema.properties!}
          />
        );
        
      default:
        return (
          <pre className="text-sm bg-gray-50 p-2 rounded border overflow-x-auto">
            {JSON.stringify(value, null, 2)}
          </pre>
        );
    }
  };

  return (
    <div className="py-2">
      <dt className="text-sm font-medium text-gray-500">
        {name}
      </dt>
      <dd className="mt-1 text-sm text-gray-900">
        {renderValue()}
      </dd>
    </div>
  );
}

interface ArrayDisplayProps {
  value: any[];
  itemSchema: JsonSchemaProperty;
}

function ArrayDisplay({ value, itemSchema }: ArrayDisplayProps) {
  if (value.length === 0) {
    return <span className="text-gray-400 italic">No items</span>;
  }

  return (
    <div className="space-y-2">
      {value.map((item, index) => (
        <div key={index} className="border-l-2 border-gray-200 pl-3">
          <SchemaDisplayField
            name=""
            schema={itemSchema}
            value={item}
          />
        </div>
      ))}
    </div>
  );
}

interface ObjectDisplayProps {
  value: Record<string, any>;
  properties: Record<string, JsonSchemaProperty>;
}

function ObjectDisplay({ value, properties }: ObjectDisplayProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
      {Object.entries(properties).map(([propertyName, propertySchema]) => (
        <SchemaDisplayField
          key={propertyName}
          name={propertyName}
          schema={propertySchema}
          value={value[propertyName]}
          required={propertySchema.required}
        />
      ))}
    </div>
  );
}
