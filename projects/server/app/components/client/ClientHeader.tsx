import React from 'react';
import { getClientIcon } from '@/lib/client-icons';
import { StatusBadge } from '@/app/components/common/StatusBadge';
import { ClientType } from '@/lib/types/clientType';

interface ClientHeaderProps {
  clientName: string;
  client: {
    type: ClientType;
    description: string | null;
    enabled: boolean;
  };
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleEnabled?: () => void;
}

export function ClientHeader({
  clientName,
  client,
  onEdit,
  onDelete,
  onToggleEnabled,
}: ClientHeaderProps) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div className="flex items-center">
          <img
            src={getClientIcon(client.type)}
            alt={`${client.type} icon`}
            className="w-9 h-9 mr-4"
          />
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-lg leading-6 font-medium text-gray-900">{clientName}</h3>
              <StatusBadge enabled={client.enabled} />
            </div>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">{client.description || 'No description'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          {onToggleEnabled && (
            <button
              onClick={onToggleEnabled}
              className={`px-4 py-2 rounded ${
                client.enabled
                  ? 'bg-yellow-600 hover:bg-yellow-700' 
                  : 'bg-green-600 hover:bg-green-700'
              } text-white`}
            >
              {client.enabled ? 'Disable' : 'Enable'}
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 