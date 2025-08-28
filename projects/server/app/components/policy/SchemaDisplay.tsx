import React from 'react';
import { SchemaDisplayField } from './SchemaDisplayField';
import { JsonSchema } from '@/lib/policy-engine/types/core';

export interface SchemaDisplayProps {
  schema: JsonSchema;
  value: Record<string, any>;
}

export function SchemaDisplay({ schema, value }: SchemaDisplayProps) {
  if (!schema.properties) {
    return <div className="text-gray-500">No properties defined</div>;
  }

  return (
    <dl className="space-y-2">
      {Object.entries(schema.properties)
        .filter(([propertyName, propertySchema]) => {
          const fieldValue = value[propertyName];
          // Show if value is defined and not empty
          return fieldValue !== undefined && 
                 fieldValue !== null && 
                 fieldValue !== '' &&
                 !(Array.isArray(fieldValue) && fieldValue.length === 0) &&
                 !(typeof fieldValue === 'object' && !Array.isArray(fieldValue) && Object.keys(fieldValue).length === 0);
        })
        .map(([propertyName, propertySchema]) => (
          <SchemaDisplayField
            key={propertyName}
            name={propertySchema.title || propertyName}
            schema={propertySchema}
            value={value[propertyName]}
            required={propertySchema.required}
        />
        ))}
    </dl>
  );
}
