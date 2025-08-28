import React from 'react';
import { PolicyAction } from '@/lib/models/types/policy';
import { PolicyElementData } from '@/lib/models/types/policyElement';
import { usePolicyElements } from '@/app/hooks/usePolicyElements';
import { SchemaDisplay } from './SchemaDisplay';

interface ActionDisplayProps {
  action: PolicyAction;
}

export function ActionDisplay({ action }: ActionDisplayProps) {
  const { elements } = usePolicyElements('action');
  const elementData = elements.find(el => el.configId === action.elementConfigId);

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="space-y-4">
        {/* Element type */}
        <div>
          <dt className="text-sm font-medium text-gray-500">Type</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {elementData?.name || action.elementClassName}
          </dd>
        </div>
        
        {/* Parameters using shared SchemaDisplay */}
        {elementData?.paramsSchema && Object.keys(action.params).length > 0 && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Parameters</dt>
            <dd className="mt-1">
              <SchemaDisplay
                schema={elementData.paramsSchema}
                value={action.params}
              />
            </dd>
          </div>
        )}
      </div>
    </div>
  );
}
