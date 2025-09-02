import { useState, useEffect } from 'react';
import { Dimensions } from '@/app/hooks/useDimensions';
import { AlertFilter } from '@/lib/models/types/alert';

interface AlertFiltersProps {
  filters: AlertFilter;
  initialFilters?: Partial<AlertFilter>;
  onFilterChange: (field: keyof AlertFilter, value: string | number | boolean | undefined) => void;
  onSearch: () => void;
  onClear: () => void;
  hasPendingChanges: boolean;
  showFilters: boolean;
  dimensions: Dimensions;
}

export function AlertFilters({
  filters,
  initialFilters = {},
  onFilterChange,
  onSearch,
  onClear,
  hasPendingChanges,
  showFilters,
  dimensions
}: AlertFiltersProps) {
  const [localFilters, setLocalFilters] = useState<AlertFilter>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleFilterChange = (field: keyof AlertFilter, value: string | number | boolean | undefined) => {
    setLocalFilters(prev => ({ ...prev, [field]: value }));
    onFilterChange(field, value);
  };

  if (!showFilters) {
    return null;
  }

  return (
    <form className="mb-4 p-4 bg-gray-50 rounded-lg">
      <div className="flex flex-wrap gap-2 items-end">
        {!('policyId' in initialFilters) && (
          <div className="min-w-[200px] max-w-[300px]">
            <label className="block text-sm text-gray-600 mb-1">Policy</label>
            <select
              value={localFilters.policyId?.toString() || ''}
              onChange={(e) => handleFilterChange('policyId', e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-1.5 py-1 text-sm border rounded"
            >
              <option value="">All Policies</option>
              {dimensions.getOptions('policyId').map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {!('conditionName' in initialFilters) && (
          <div className="min-w-[150px] max-w-[250px]">
            <label className="block text-sm text-gray-600 mb-1">Condition</label>
            <select
              value={localFilters.conditionName || ''}
              onChange={(e) => handleFilterChange('conditionName', e.target.value || undefined)}
              className="w-full px-1.5 py-1 text-sm border rounded"
            >
              <option value="">All Conditions</option>
              {dimensions.getOptions('conditionName').map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {!('severity' in initialFilters) && (
          <div className="min-w-[100px] max-w-[150px]">
            <label className="block text-sm text-gray-600 mb-1">Severity</label>
            <select
              value={localFilters.severity?.toString() || ''}
              onChange={(e) => handleFilterChange('severity', e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-1.5 py-1 text-sm border rounded"
            >
              <option value="">All</option>
              {dimensions.getOptions('severity').map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {!('seen' in initialFilters) && (
          <div className="min-w-[100px] max-w-[150px]">
            <label className="block text-sm text-gray-600 mb-1">Status</label>
            <select
              value={localFilters.seen === undefined ? '' : localFilters.seen ? 'seen' : 'unseen'}
              onChange={(e) => handleFilterChange('seen', e.target.value ? e.target.value === 'seen' : undefined)}
              className="w-full px-1.5 py-1 text-sm border rounded"
            >
              <option value="">All</option>
              {dimensions.getOptions('seen').map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {!('serverId' in initialFilters) && (
          <div className="min-w-[200px] max-w-[300px]">
            <label className="block text-sm text-gray-600 mb-1">Server</label>
            <select
              value={localFilters.serverId?.toString() || ''}
              onChange={(e) => handleFilterChange('serverId', e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-1.5 py-1 text-sm border rounded"
            >
              <option value="">All Servers</option>
              {dimensions.getOptions('serverId').map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {!('clientId' in initialFilters) && (
          <div className="min-w-[200px] max-w-[300px]">
            <label className="block text-sm text-gray-600 mb-1">Client</label>
            <select
              value={localFilters.clientId?.toString() || ''}
              onChange={(e) => handleFilterChange('clientId', e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-1.5 py-1 text-sm border rounded"
            >
              <option value="">All Clients</option>
              {dimensions.getOptions('clientId').map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </form>
  );
} 