export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export async function validatePolicyElementParams(configId: number, params: any): Promise<ValidationResult> {
  try {
    const response = await fetch(`/api/v1/policyElements/${configId}/validate/params`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params })
    });
    
    const json = await response.json();
    if (!response.ok) {
      return { isValid: false, errors: [json.message || 'Validation failed'] };
    }
    
    return json.validation;
  } catch (error) {
    return { 
      isValid: false, 
      errors: [error instanceof Error ? error.message : 'Validation failed'] 
    };
  }
}

export async function validatePolicyElementConfig(configId: number, config: any): Promise<ValidationResult> {
  try {
    const response = await fetch(`/api/v1/policyElements/${configId}/validate/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config })
    });
    
    const json = await response.json();
    if (!response.ok) {
      return { isValid: false, errors: [json.message || 'Validation failed'] };
    }
    
    return json.validation;
  } catch (error) {
    return { 
      isValid: false, 
      errors: [error instanceof Error ? error.message : 'Validation failed'] 
    };
  }
}
