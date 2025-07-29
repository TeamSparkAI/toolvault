import React from 'react';
import { AlertList } from './AlertList';
import { AlertFilters } from './AlertFilters';
import { AlertsMenu } from './AlertsMenu';
import { AlertReadData, AlertFilter } from '@/lib/models/types/alert';
import { Dimensions, useDimensions } from '@/app/hooks/useDimensions';
import { log } from '@/lib/logging/console';

interface AlertsSectionProps {
  initialFilters?: Partial<AlertFilter>;
  dimensions?: Dimensions;
}

export function AlertsSection({
  initialFilters = {},
  dimensions: providedDimensions,
}: AlertsSectionProps) {
  const [filters, setFilters] = React.useState<AlertFilter>({
    policyId: undefined,
    filterName: undefined,
    seen: undefined,
    severity: undefined,
    serverId: undefined,
    clientId: undefined,
    ...initialFilters
  });
  const [pendingFilters, setPendingFilters] = React.useState<AlertFilter>(filters);
  const [showFilters, setShowFilters] = React.useState(false);
  const [hasPendingChanges, setHasPendingChanges] = React.useState(false);
  const [alerts, setAlerts] = React.useState<AlertReadData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [cursor, setCursor] = React.useState<number | undefined>();
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');
  const [totalAlerts, setTotalAlerts] = React.useState<number>(0);

  const dimensions = providedDimensions ?? useDimensions({
    dimensions: ['policyId', 'filterName', 'severity', 'seen', 'serverId', 'clientId'],
    autoFetch: true,
    filters: {
      policyId: initialFilters.policyId,
      filterName: initialFilters.filterName,
      severity: initialFilters.severity,
      seen: initialFilters.seen,
      serverId: initialFilters.serverId,
      clientId: initialFilters.clientId
    }
  }).dimensions;

  const loadAlerts = async (currentCursor?: number, sort: 'asc' | 'desc' = sortDirection, filters = pendingFilters) => {
    try {
      log.debug('Loading alerts with filters:', filters);
      log.debug('Current cursor:', currentCursor);
      log.debug('Sort direction:', sort);
      
      setLoading(true);
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          log.debug(`Adding filter: ${key}=${value}`);
          queryParams.append(key, value.toString());
        }
      });
      if (currentCursor) {
        log.debug('Adding cursor:', currentCursor);
        queryParams.append('cursor', currentCursor.toString());
      }
      queryParams.append('sort', sort);

      const url = `/api/v1/alerts?${queryParams.toString()}`;
      log.debug('Fetching alerts from:', url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to load alerts');
      }
      const data = await response.json();
      log.debug('Received alerts:', {
        count: data.alerts.length,
        total: data.pagination.total,
        hasMore: data.pagination.hasMore,
        nextCursor: data.pagination.nextCursor
      });
      
      if (currentCursor) {
        // Append alerts when loading more
        setAlerts(prev => [...prev, ...data.alerts]);
      } else {
        // Replace alerts when filters change
        setAlerts(data.alerts);
      }
      setHasMore(data.pagination.hasMore);
      setCursor(data.pagination.nextCursor);
      setTotalAlerts(data.pagination.total);
    } catch (err) {
      log.error('Error loading alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadAlerts();
  }, []);

  const handleFilterChange = (field: keyof AlertFilter, value: string | number | boolean | undefined) => {
    log.debug('Filter change:', { field, value });
    
    // Create new pending filters with the change
    const newPendingFilters = { ...pendingFilters, [field]: value };
    
    // Since all filters are dropdowns, apply immediately
    setPendingFilters(newPendingFilters);
    setFilters(newPendingFilters);
    setCursor(undefined);
    loadAlerts(undefined, sortDirection, newPendingFilters);
  };

  const handleSearch = () => {
    log.debug('Search triggered with filters:', pendingFilters);
    setFilters(pendingFilters);
    setHasPendingChanges(false);
    setCursor(undefined);
    loadAlerts(undefined, sortDirection, pendingFilters);
  };

  const handleClear = () => {
    log.debug('Clearing filters');
    const emptyFilters: AlertFilter = {
      policyId: undefined,
      filterName: undefined,
      seen: undefined,
      severity: undefined,
      serverId: undefined,
      clientId: undefined,
      ...initialFilters
    };
    setPendingFilters(emptyFilters);
    setFilters(emptyFilters);
    setHasPendingChanges(false);
    setCursor(undefined);
    loadAlerts(undefined, sortDirection, emptyFilters);
    setShowFilters(false);
  };

  const handleLoadMore = () => {
    log.debug('Loading more alerts');
    loadAlerts(cursor);
  };

  const handleSortDirectionChange = () => {
    const newDirection = sortDirection === 'desc' ? 'asc' : 'desc';
    setSortDirection(newDirection);
    setCursor(undefined);
    loadAlerts(undefined, newDirection);
  };

  const toggleFilters = () => {
    if (showFilters) {
      handleClear();
    } else {
      setShowFilters(true);
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Alerts</h2>
          <button
            onClick={toggleFilters}
            className="text-sm text-blue-500 hover:text-blue-700"
          >
            {showFilters ? 'Clear Filters' : 'Filter'}
          </button>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleSortDirectionChange}
            className="text-sm text-blue-500 hover:text-blue-700"
          >
            Sort {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
          <span className="text-sm text-gray-500">
            {alerts.length === 0 ? '0 alerts' : `${alerts.length} of ${totalAlerts || 'N/A'} alerts`}
          </span>
          <AlertsMenu onRefresh={loadAlerts} currentFilters={filters} initialFilters={initialFilters} />
        </div>
      </div>

      <AlertFilters
        filters={filters}
        initialFilters={initialFilters}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onClear={handleClear}
        hasPendingChanges={hasPendingChanges}
        showFilters={showFilters}
        dimensions={dimensions}
      />

      <AlertList
        alerts={alerts}
        isLoading={loading}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        initialFilters={initialFilters}
        dimensions={dimensions}
      />
    </div>
  );
} 