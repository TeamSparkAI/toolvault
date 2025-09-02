'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertsDashboard } from '../components/alerts/AlertsDashboard';
import { AlertList } from '../components/alerts/AlertList';
import { AlertsMenu } from '../components/alerts/AlertsMenu';
import { AlertReadData, AlertFilter } from '@/lib/models/types/alert';
import { NewAlertsSummary } from '@/app/components/alerts/NewAlertsSummary';
import { useDimensions } from '@/app/hooks/useDimensions';
import { log } from '@/lib/logging/console';

function AlertsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertReadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  // Initialize filters from URL parameters synchronously
  const getInitialFilters = (): AlertFilter => {
    const urlFilters: AlertFilter = {};
    
    const severity = searchParams.get('severity');
    if (severity) urlFilters.severity = parseInt(severity);
    
    const policyId = searchParams.get('policyId');
    if (policyId) urlFilters.policyId = parseInt(policyId);
    
    const seen = searchParams.get('seen');
    if (seen) urlFilters.seen = seen === 'true';
    
    const serverId = searchParams.get('serverId');
    if (serverId) urlFilters.serverId = parseInt(serverId);
    
    const clientId = searchParams.get('clientId');
    if (clientId) urlFilters.clientId = parseInt(clientId);
    
    const conditionName = searchParams.get('conditionName');
    if (conditionName) urlFilters.conditionName = conditionName;

    return urlFilters;
  };

  const initialFilters = getInitialFilters();
  const [filters, setFilters] = useState<AlertFilter>(initialFilters);
  const [pendingFilters, setPendingFilters] = useState<AlertFilter>(initialFilters);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalAlerts, setTotalAlerts] = useState<number>(0);
  const [filtersInitialized, setFiltersInitialized] = useState(Object.keys(initialFilters).length > 0);
  const { dimensions, isLoading: dimensionsLoading, error: dimensionsError } = useDimensions({
    dimensions: ['policyId', 'conditionName', 'severity', 'seen', 'serverId', 'clientId']
  });

  // Update filters when searchParams change
  useEffect(() => {
    const urlFilters = getInitialFilters();
    setFilters(urlFilters);
    setPendingFilters(urlFilters);
    setFiltersInitialized(true);
  }, [searchParams]);

  useEffect(() => {
    fetchAlerts();
  }, [filters, sortDirection]);

  const updateURL = (newFilters: AlertFilter) => {
    const params = new URLSearchParams();
    
    if (newFilters.severity !== undefined) params.set('severity', newFilters.severity.toString());
    if (newFilters.policyId !== undefined) params.set('policyId', newFilters.policyId.toString());
    if (newFilters.seen !== undefined) params.set('seen', newFilters.seen.toString());
    if (newFilters.serverId !== undefined) params.set('serverId', newFilters.serverId.toString());
    if (newFilters.clientId !== undefined) params.set('clientId', newFilters.clientId.toString());
    if (newFilters.conditionName !== undefined) params.set('conditionName', newFilters.conditionName);
    
    const newURL = params.toString() ? `?${params.toString()}` : '';
    router.replace(`/alerts${newURL}`, { scroll: false });
  };

  const fetchAlerts = async (nextCursor?: number | null) => {
    if (nextCursor) {
      setIsLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.set('sort', sortDirection);
      
      // Add filters
      if (filters.policyId !== undefined) queryParams.set('policyId', filters.policyId.toString());
      if (filters.conditionName !== undefined) queryParams.set('conditionName', filters.conditionName);
      if (filters.seen !== undefined) queryParams.set('seen', filters.seen.toString());
      if (filters.severity !== undefined) queryParams.set('severity', filters.severity.toString());
      if (filters.serverId !== undefined) queryParams.set('serverId', filters.serverId.toString());
      if (filters.clientId !== undefined) queryParams.set('clientId', filters.clientId.toString());

      // Add cursor if provided
      if (nextCursor) {
        queryParams.set('cursor', nextCursor.toString());
      }

      const response = await fetch(`/api/v1/alerts?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }

      const data = await response.json();
      
      if (nextCursor) {
        setAlerts(prev => [...prev, ...data.alerts]);
      } else {
        setAlerts(data.alerts);
      }
      
      setHasMore(data.pagination?.hasMore ?? false);
      setCursor(data.pagination?.nextCursor ? Number(data.pagination.nextCursor) : null);
      setTotalAlerts(data.pagination?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleFilterChange = (field: keyof AlertFilter, value: string | number | boolean | undefined) => {
    log.debug('Filter change:', { field, value });
    
    // Create new pending filters with the change
    const newPendingFilters = { ...pendingFilters, [field]: value };
    
    // Since all filters are dropdowns, apply immediately
    setPendingFilters(newPendingFilters);
    setFilters(newPendingFilters);
    updateURL(newPendingFilters);
    setCursor(null);
    fetchAlerts();
  };

  const applyFilters = () => {
    setFilters(pendingFilters);
    updateURL(pendingFilters);
    setCursor(null);
  };

  const clearFilters = () => {
    const emptyFilters: AlertFilter = {};
    setPendingFilters(emptyFilters);
    setFilters(emptyFilters);
    updateURL(emptyFilters);
    setCursor(null);
    setShowFilters(false);
  };

  const toggleFilters = () => {
    if (showFilters) {
      clearFilters();
    } else {
      setShowFilters(true);
    }
  };

  const loadMore = () => {
    if (cursor && hasMore && !isLoadingMore) {
      fetchAlerts(cursor);
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
    <div className="space-y-6">
      <NewAlertsSummary showSeparator={true} showReviewLink={false} currentFilters={filters} />
      <AlertsDashboard
        filters={pendingFilters}
        onFilterChange={handleFilterChange}
        onSearch={applyFilters}
        onClear={clearFilters}
        hasPendingChanges={JSON.stringify(filters) !== JSON.stringify(pendingFilters)}
        showFilters={showFilters}
        onToggleFilters={toggleFilters}
        activeFilters={filters}
        alerts={alerts}
        isLoading={loading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        sortDirection={sortDirection}
        onSort={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
        totalAlerts={totalAlerts}
        dimensions={dimensions}
        filtersInitialized={filtersInitialized}
      />

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Alerts</h2>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="text-sm text-blue-500 hover:text-blue-700"
            >
              Sort {sortDirection === 'asc' ? '↑' : '↓'}
            </button>
            <span className="text-sm text-gray-500">
              {alerts.length === 0 ? '0 alerts' : `${alerts.length} of ${totalAlerts || 'N/A'} alerts`}
            </span>
            <AlertsMenu onRefresh={fetchAlerts} currentFilters={filters} initialFilters={{}} />
          </div>
        </div>

        <AlertList
          alerts={alerts}
          isLoading={loading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          dimensions={dimensions}
        />
      </div>
    </div>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <AlertsPageContent />
    </Suspense>
  );
} 