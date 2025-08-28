import React from 'react';
import { SchemaFormField } from './SchemaFormField';
import { JsonSchema } from '@/lib/policy-engine/types/core';

export interface SchemaFormProps {
  schema: JsonSchema;
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  errors?: Record<string, string>;
}

export function SchemaForm({ schema, value, onChange, errors = {} }: SchemaFormProps) {
  if (!schema.properties) {
    return <div className="text-gray-500">No properties defined in schema</div>;
  }

  return (
    <div className="space-y-4">
      {Object.entries(schema.properties).map(([propertyName, propertySchema]) => (
        <SchemaFormField
          key={propertyName}
          name={propertySchema.title || propertyName}
          schema={propertySchema}
          value={value[propertyName]}
          onChange={(newValue) => onChange({ ...value, [propertyName]: newValue })}
          required={schema.required?.includes(propertyName)}
          error={errors[propertyName]}
        />
      ))}
    </div>
  );
}
