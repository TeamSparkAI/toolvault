import React from 'react';
import { Dimensions } from '@/app/hooks/useDimensions';
import { MessageFilter } from '@/lib/models/types/message';

interface MessageFiltersProps {
  filters: MessageFilter;
  initialFilters?: Partial<MessageFilter>;
  onFilterChange: (field: keyof MessageFilter, value: string | number | undefined) => void;
  onSearch: () => void;
  onClear: () => void;
  hasPendingChanges: boolean;
  showFilters: boolean;
  dimensions: Dimensions;
}

export function MessageFilters({
  filters,
  initialFilters = {},
  onFilterChange,
  onSearch,
  onClear,
  hasPendingChanges,
  showFilters,
  dimensions
}: MessageFiltersProps) {
  if (!showFilters) {
    return null;
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="mb-4 p-4 bg-gray-50 rounded-lg">
      <div className="flex justify-end items-center mb-2">
        <button
          type="button"
          onClick={onSearch}
          disabled={!hasPendingChanges}
          className={`px-3 py-1 text-sm rounded ${
            hasPendingChanges
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          Search
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {!('serverId' in initialFilters) && (
          <div>
            <label className="block text-sm text-gray-600 mb-1">Server</label>
            <select
              value={filters.serverName || ''}
              onChange={(e) => onFilterChange('serverName', e.target.value)}
              className="w-full px-1.5 py-1 text-sm border rounded"
            >
              <option value="">All Servers</option>
              {dimensions.getOptions('serverName').sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase())).map(server => (
                <option key={server.value} value={server.value}>
                  {server.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {!('method' in initialFilters) && (
          <div>
            <label className="block text-sm text-gray-600 mb-1">Method</label>
            <select
              value={filters.payloadMethod || ''}
              onChange={(e) => onFilterChange('payloadMethod', e.target.value)}
              className="w-full px-1.5 py-1 text-sm border rounded"
            >
              <option value="">All Methods</option>
              {dimensions.getOptions('payloadMethod').sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase())).map(method => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {!('toolName' in initialFilters) && (
          <div>
            <label className="block text-sm text-gray-600 mb-1">Tool</label>
            <select
              value={filters.payloadToolName || ''}
              onChange={(e) => onFilterChange('payloadToolName', e.target.value)}
              className="w-full px-1.5 py-1 text-sm border rounded"
            >
              <option value="">All Tools</option>
              {dimensions.getOptions('payloadToolName').sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase())).map(tool => (
                <option key={tool.value} value={tool.value}>
                  {tool.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {!('clientId' in initialFilters) && (
          <div>
            <label className="block text-sm text-gray-600 mb-1">Client</label>
            <select
              value={filters.clientId?.toString() || ''}
              onChange={(e) => onFilterChange('clientId', e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-1.5 py-1 text-sm border rounded"
            >
              <option value="">All Clients</option>
              {dimensions.getOptions('clientId').sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase())).map(client => (
                <option key={client.value} value={client.value}>
                  {client.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {!('sourceIP' in initialFilters) && (
          <div>
            <label className="block text-sm text-gray-600 mb-1">Source IP</label>
            <select
              value={filters.sourceIP || ''}
              onChange={(e) => onFilterChange('sourceIP', e.target.value)}
              className="w-full px-1.5 py-1 text-sm border rounded"
            >
              <option value="">All IPs</option>
              {dimensions.getOptions('sourceIP').sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase())).map(ip => (
                <option key={ip.value} value={ip.value}>
                  {ip.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {!('sessionId' in initialFilters) && (
          <div>
            <label className="block text-sm text-gray-600 mb-1">Session ID</label>
            <input
              type="text"
              value={filters.sessionId || ''}
              onChange={(e) => onFilterChange('sessionId', e.target.value)}
              className="w-full px-1.5 py-1 text-sm border rounded"
              placeholder="Filter by session"
            />
          </div>
        )}
      </div>
    </form>
  );
} 