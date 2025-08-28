import React from 'react';
import { JsonSchema } from '@/lib/policy-engine/types/core';

export interface SchemaFormFieldProps {
  name: string;
  schema: JsonSchema;
  value: any;
  onChange: (value: any) => void;
  required?: boolean;
  error?: string;
}

export function SchemaFormField({ name, schema, value, onChange, required, error }: SchemaFormFieldProps) {
  // Use schema default if value is undefined
  const displayValue = value !== undefined ? value : schema.default;
  
  const renderField = () => {
    switch (schema.type) {
      case 'string':
        if (schema.enum) {
          return (
            <select 
              value={displayValue || ''} 
              onChange={(e) => onChange(e.target.value)}
              className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                error ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="">Select...</option>
              {schema.enum.map(option => (
                <option key={option} value={option}>
                  {schema.enumLabels?.[option] || option}
                </option>
              ))}
            </select>
          );
        }
        if (schema.format === 'multiline') {
          return (
            <textarea
              value={displayValue || ''}
              onChange={(e) => onChange(e.target.value)}
              rows={3}
              className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                error ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder={schema.description}
            />
          );
        }
        return (
          <input
            type="text"
            value={displayValue || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
              error ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder={schema.description}
          />
        );
        
      case 'number':
        return (
          <input
            type="number"
            value={displayValue !== undefined ? displayValue : ''}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            min={schema.minimum}
            max={schema.maximum}
            step={schema.multipleOf}
            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
              error ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder={schema.description}
          />
        );
        
      case 'boolean':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={displayValue || false}
              onChange={(e) => onChange(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">{schema.description}</span>
          </div>
        );
        
      case 'array':
        return (
          <ArrayField
            value={displayValue || []}
            onChange={onChange}
            itemSchema={schema.items!}
            error={error}
          />
        );
        
      case 'object':
        return (
          <ObjectField
            value={displayValue || {}}
            onChange={onChange}
            properties={schema.properties!}
            required={schema.required}
            error={error}
          />
        );
        
      default:
        return (
          <input
            type="text"
            value={JSON.stringify(value) || ''}
            onChange={(e) => {
              try {
                onChange(JSON.parse(e.target.value));
              } catch {
                // Invalid JSON, keep as string
              }
            }}
            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
              error ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter JSON"
          />
        );
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {name} {required && <span className="text-red-500">*</span>}
      </label>
      {renderField()}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {schema.description && !error && (
        <p className="mt-1 text-sm text-gray-500">{schema.description}</p>
      )}
    </div>
  );
}

interface ArrayFieldProps {
  value: any[];
  onChange: (value: any[]) => void;
  itemSchema: JsonSchema;
  error?: string;
}

function ArrayField({ value, onChange, itemSchema, error }: ArrayFieldProps) {
  const addItem = () => {
    const newItem = getDefaultValue(itemSchema);
    onChange([...value, newItem]);
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, newValue: any) => {
    const newArray = [...value];
    newArray[index] = newValue;
    onChange(newArray);
  };

  return (
    <div className="space-y-2">
      {value.map((item, index) => (
        <div key={index} className="flex items-center space-x-2">
          <div className="flex-1">
            <SchemaFormField
              name=""
              schema={itemSchema}
              value={item}
              onChange={(newValue) => updateItem(index, newValue)}
            />
          </div>
          <button
            onClick={() => removeItem(index)}
            className="p-1 text-red-600 hover:text-red-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
      >
        <svg className="h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        Add Item
      </button>
    </div>
  );
}

interface ObjectFieldProps {
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  properties: Record<string, JsonSchema>;
  required?: string[];
  error?: string;
}

function ObjectField({ value, onChange, properties, required, error }: ObjectFieldProps) {
  const updateField = (fieldName: string, fieldValue: any) => {
    onChange({ ...value, [fieldName]: fieldValue });
  };

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
      {Object.entries(properties).map(([fieldName, fieldSchema]) => (
        <SchemaFormField
          key={fieldName}
          name={fieldName}
          schema={fieldSchema}
          value={value[fieldName]}
          onChange={(newValue) => updateField(fieldName, newValue)}
          required={required?.includes(fieldName)}
        />
      ))}
    </div>
  );
}

function getDefaultValue(schema: JsonSchema): any {
  switch (schema.type) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return null;
  }
}
