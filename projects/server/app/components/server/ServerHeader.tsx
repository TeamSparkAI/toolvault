import React from 'react';
import { StatusBadge } from '@/app/components/common/StatusBadge';
import { SecurityBadge } from '@/app/components/common/SecurityBadge';
import { Server } from '@/lib/types/server';
import { getServerIconUrl } from '@/lib/utils/githubImageUrl';
import { getServerDisplayInfo } from '@/lib/utils/serverDisplay';

interface ServerHeaderProps {
  serverName: string;
  server: Server;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleEnabled?: () => void;
  onPing?: () => void;
}

export function ServerHeader({ 
  serverName,
  server,
  onEdit, 
  onDelete,
  onToggleEnabled,
  onPing
}: ServerHeaderProps) {


  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div className="flex items-center">
          <img
            src={getServerIconUrl(server)}
            alt="MCP icon"
            className="w-9 h-9 mr-4"
          />
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-lg leading-6 font-medium text-gray-900">{serverName}</h3>
              {server.security === 'unmanaged' ? (
                <SecurityBadge securityType="unmanaged" />
              ) : (
                <StatusBadge enabled={server.enabled} />
              )}
            </div>
            {server.description ? (
              <p className="mt-1 max-w-2xl text-sm text-gray-600">
                {server.description}
              </p>
            ) : (
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {getServerDisplayInfo(server)}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          {onPing && (
            <button
              onClick={onPing}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Ping
            </button>
          )}
          {onToggleEnabled && (
            <button
              onClick={onToggleEnabled}
              className={`px-4 py-2 rounded ${
                server.enabled
                  ? 'bg-yellow-600 hover:bg-yellow-700' 
                  : 'bg-green-600 hover:bg-green-700'
              } text-white`}
            >
              {server.enabled ? 'Disable' : 'Enable'}
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