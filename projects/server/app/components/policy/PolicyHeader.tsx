import React from 'react';
import { StatusBadge } from '@/app/components/common/StatusBadge';
import { PolicyData } from '@/lib/models/types/policy';

interface PolicyHeaderProps {
  policy: PolicyData;
  onEdit: () => void;
  onDelete?: () => void;
  onToggleEnabled?: () => void;
}

export function PolicyHeader({ 
  policy,
  onEdit, 
  onDelete, 
  onToggleEnabled
}: PolicyHeaderProps) {
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <div className="flex justify-between items-start">
          <div className="flex-grow pr-4">
            <div className="flex items-baseline gap-2">
              <h3 className="text-lg leading-6 font-medium text-gray-900">{policy.name}</h3>
              <StatusBadge enabled={policy.enabled} />
            </div>
            <p className="mt-1 text-sm text-gray-500">{policy.description || 'No description'}</p>
          </div>
          <div className="flex-shrink-0 flex flex-wrap gap-4">
            <button
              onClick={onToggleEnabled}
              className={`px-4 py-2 rounded ${
                policy.enabled 
                  ? 'bg-yellow-600 hover:bg-yellow-700' 
                  : 'bg-green-600 hover:bg-green-700'
              } text-white`}
            >
              {policy.enabled ? 'Disable' : 'Enable'}
            </button>
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 