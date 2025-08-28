import React, { useEffect, useState } from 'react';
import { PolicyAction } from '@/lib/models/types/policy';
import { PolicyElementData } from '@/lib/models/types/policyElement';
import { usePolicyElements } from '@/app/hooks/usePolicyElements';
import { SchemaForm } from './SchemaForm';
import { validatePolicyElementParams } from '@/app/lib/validation';

interface ActionEditorProps {
  action: PolicyAction;
  onUpdate: (action: PolicyAction) => void;
  onRemove: () => void;
}

export function ActionEditor({ action, onUpdate, onRemove }: ActionEditorProps) {
  const { elements } = usePolicyElements('action');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const elementData = elements.find(el => el.configId === action.elementConfigId);

  // Validate on change
  useEffect(() => {
    if (elementData && action.params) {
      validatePolicyElementParams(elementData.configId, action.params).then(validation => {
        if (!validation.isValid) {
          setErrors({ params: validation.errors[0] || 'Invalid parameters' });
        } else {
          setErrors({});
        }
      });
    }
  }, [action.params, elementData]);

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-grow space-y-4">
          {/* Element class name (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <input 
              type="text" 
              value={elementData?.name || action.elementClassName}
              disabled
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50"
            />
          </div>
          
          {/* Dynamic parameters using shared SchemaForm */}
          {elementData?.paramsSchema && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Parameters</label>
              <div className="mt-1">
                <SchemaForm
                  schema={elementData.paramsSchema}
                  value={action.params}
                  onChange={(params) => onUpdate({...action, params})}
                  errors={errors}
                />
              </div>
            </div>
          )}
        </div>
        
        <button onClick={onRemove} className="ml-4 p-2 text-red-600 hover:text-red-800">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
