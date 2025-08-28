import React from 'react';
import { PolicyCondition } from '@/lib/models/types/policy';
import { PolicyElementData } from '@/lib/models/types/policyElement';
import { usePolicyElements } from '@/app/hooks/usePolicyElements';
import { SchemaDisplay } from './SchemaDisplay';

interface ConditionDisplayProps {
  condition: PolicyCondition;
}

export function ConditionDisplay({ condition }: ConditionDisplayProps) {
  const { elements } = usePolicyElements('condition');
  const elementData = elements.find(el => el.configId === condition.elementConfigId);

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="space-y-4">
        {/* Element type */}
        <div>
          <dt className="text-sm font-medium text-gray-500">Type</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {elementData?.name || condition.elementClassName}
          </dd>
        </div>
        
        {/* Name */}
        <div>
          <dt className="text-sm font-medium text-gray-500">Name</dt>
          <dd className="mt-1 text-sm text-gray-900 font-medium">
            {condition.name}
          </dd>
        </div>
        
        {/* Notes */}
        {condition.notes && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Notes</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {condition.notes}
            </dd>
          </div>
        )}
        
        {/* Parameters using shared SchemaDisplay */}
        {elementData?.paramsSchema && Object.keys(condition.params).length > 0 && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Parameters</dt>
            <dd className="mt-1">
              <SchemaDisplay
                schema={elementData.paramsSchema}
                value={condition.params}
              />
            </dd>
          </div>
        )}
      </div>
    </div>
  );
}
