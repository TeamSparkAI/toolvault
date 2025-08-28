import { JsonSchema } from '@/lib/policy-engine/types/core';

export function getDefaultValue(schema: JsonSchema): any {
  // Use schema's default if provided
  if (schema.default !== undefined) {
    return schema.default;
  }
  
  // Fall back to type-based defaults
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

export function getDefaultParams(schema: JsonSchema): Record<string, any> {
  if (schema.type !== 'object' || !schema.properties) {
    return {};
  }

  const params: Record<string, any> = {};
  for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
    params[propertyName] = getDefaultValue(propertySchema);
  }
  return params;
}
