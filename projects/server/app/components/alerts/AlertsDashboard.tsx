import React, { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, BarChart, Bar } from 'recharts';
import { AlertFilters } from './AlertFilters';
import { AlertReadData, AlertFilter } from '@/lib/models/types/alert';
import { TimeRangeSelector } from '../charts/TimeRangeSelector';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { AlertTimeSeriesPayload } from '@/app/api/v1/analytics/alerts/timeSeries/route';
import { AlertAggregatePayload } from '@/app/api/v1/analytics/alerts/aggregate/route';
import { fillTimeSeriesData } from '@/app/lib/utils/timeSeries';
import { getSeverityLevel, getSeverityLevels, getSeverityColor } from '@/lib/severity';
import { Dimensions } from '@/app/hooks/useDimensions';
import { useRouter } from 'next/navigation';
import { toggleFilterInUrl } from '@/app/lib/utils/urlParams';
import { log } from '@/lib/logging/console';

interface AlertsDashboardProps {
  filters: AlertFilter;
  onFilterChange: (field: keyof AlertFilter, value: string | number | boolean | undefined) => void;
  onSearch: () => void;
  onClear: () => void;
  hasPendingChanges: boolean;
  showFilters: boolean;
  onToggleFilters: () => void;
  activeFilters: AlertFilter;
  alerts?: AlertReadData[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  sortDirection?: 'asc' | 'desc';
  onSort?: () => void;
  totalAlerts?: number;
  dimensions: Dimensions;
  filtersInitialized?: boolean;
}

type TimeRange = '7days' | '30days' | 'all';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

function calculateTimeRange(range: TimeRange) {
  const endTime = new Date();
  let startTime = new Date();

  switch (range) {
    case '7days':
      startTime.setDate(endTime.getDate() - 7);
      break;
    case '30days':
      startTime.setDate(endTime.getDate() - 30);
      break;
    case 'all':
      startTime = new Date(0); // Beginning of time
      break;
  }

  return { startTime, endTime };
}

export function AlertsDashboard({
  filters,
  onFilterChange,
  onSearch,
  onClear,
  hasPendingChanges,
  showFilters,
  onToggleFilters,
  activeFilters,
  alerts = [],
  isLoading: alertsLoading = false,
  hasMore = false,
  onLoadMore = () => {},
  sortDirection = 'desc',
  onSort = () => {},
  totalAlerts,
  dimensions,
  filtersInitialized = false
}: AlertsDashboardProps) {
  const router = useRouter();
  const [timeSeriesData, setTimeSeriesData] = useState<Array<{ timestamp: string; counts: Record<string, number> }>>([]);
  const [policyData, setPolicyData] = useState<Array<{ name: string; value: number }>>([]);
  const [severityData, setSeverityData] = useState<Array<{ name: string; value: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [animationId, setAnimationId] = useState(0);
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const lastUpdateRef = useRef<number>(0);
  const renderCountRef = useRef(0);

  // Handle severity bar click
  const handleSeverityClick = (event: any) => {
    log.debug('Chart click event:', event);
    if (event && event.activeLabel) {
      const severityName = event.activeLabel;
      const severityLevel = getSeverityLevels().find(level => level.name === severityName);
      if (severityLevel) {
        const newURL = toggleFilterInUrl('severity', severityLevel.value, activeFilters.severity);
        router.push(`/alerts${newURL}`);
      }
    }
  };

  // Handle policy legend click
  const handlePolicyLegendClick = (entry: any) => {
    log.debug('Policy legend click:', entry);
    if (entry && entry.dataKey) {
      // Extract policy ID from dataKey (e.g., "counts.7" -> "7")
      const policyId = entry.dataKey.replace('counts.', '');
      const newURL = toggleFilterInUrl('policyId', policyId, activeFilters.policyId);
      router.push(`/alerts${newURL}`);
    }
  };

  // Log renders
  useEffect(() => {
    renderCountRef.current += 1;
    log.debug('Component rendered:', {
      renderCount: renderCountRef.current,
      policyData,
      animationId,
      activeFilters,
      timeSeriesData: timeSeriesData.length
    });
  });

  useEffect(() => {
    const fetchData = async () => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateRef.current;
      log.debug('Time since last update:', timeSinceLastUpdate, 'ms');
      
      // If we've updated in the last 500ms, skip this update
      if (timeSinceLastUpdate < 500) {
        log.debug('Skipping update - too soon after last update');
        return;
      }
      
      // Skip initial fetch if filters haven't been properly initialized yet
      if (isInitialLoad && !filtersInitialized) {
        log.debug('Skipping initial fetch - filters not yet initialized');
        return;
      }
      
      lastUpdateRef.current = now;
      log.debug('Starting data fetch with filters:', activeFilters);
      log.debug('Filters object keys:', Object.keys(activeFilters));
      log.debug('Severity filter value:', activeFilters.severity);
      log.debug('Current state:', {
        policyData,
        animationId
      });

      try {
        // Only show full loading state on initial load
        if (isInitialLoad) {
          setIsLoading(true);
        }
        setError(null);

        // Calculate time range
        const { startTime, endTime } = calculateTimeRange(timeRange);

        const queryParams = new URLSearchParams();
        queryParams.set('dimension', 'policyId');
        queryParams.set('timeUnit', 'day');
        if (timeRange !== 'all') {
          queryParams.set('startTime', startTime.toISOString());
        }
        queryParams.set('endTime', endTime.toISOString());

        // Add active filters
        log.debug('Adding filters to query params:', activeFilters);
        Object.entries(activeFilters).forEach(([key, value]) => {
          log.debug('Processing filter:', { key, value });
          if (key === 'severity' && value !== undefined) {
            // If value is already a number string, use it directly
            const severityNumber = !isNaN(Number(value)) ? Number(value) : getSeverityLevels().find(level => level.name === value.toString())?.value || 0;
            log.debug('Severity filter:', { name: value, number: severityNumber });
            if (severityNumber) {
              queryParams.set(key, severityNumber.toString());
            }
          } else if (value) {
            queryParams.set(key, value.toString());
          }
        });

        log.debug('Final query params for charts:', queryParams.toString());

        const [timeSeriesResponse, policyResponse, severityResponse] = await Promise.all([
          fetch(`/api/v1/analytics/alerts/timeSeries?${queryParams.toString()}`).then(r => r.json()),
          fetch(`/api/v1/analytics/alerts/aggregate?dimension=policyId&${queryParams.toString()}`).then(r => r.json()),
          fetch(`/api/v1/analytics/alerts/aggregate?dimension=severity&${queryParams.toString()}`).then(r => r.json())
        ]);

        log.debug('Severity response:', severityResponse);

        const timeSeriesData = new JsonResponseFetch<AlertTimeSeriesPayload>(timeSeriesResponse, 'timeSeries');
        const policyData = new JsonResponseFetch<AlertAggregatePayload>(policyResponse, 'aggregate');
        const severityData = new JsonResponseFetch<AlertAggregatePayload>(severityResponse, 'aggregate');

        if (timeSeriesData.isSuccess() && policyData.isSuccess() && severityData.isSuccess()) {
          // Fill in missing data points for time series
          const rawData = timeSeriesData.payload.data;
          const filledData = fillTimeSeriesData(rawData, startTime, endTime, timeRange);
          setTimeSeriesData(filledData);
          
          // Map AlertAggregateData to the format expected by the chart
          const mappedPolicyData = policyData.payload.data.map(item => ({
            name: item.value,
            value: item.count
          }));
          setPolicyData(mappedPolicyData);
          // Map severity data and ensure all severities are present
          const severityMap = new Map(severityData.payload.data.map(item => [parseInt(item.value), item.count]));
          const mappedSeverityData = [1, 2, 3, 4, 5].map(severity => ({
            name: getSeverityLevel(severity).name,
            value: severityMap.get(severity) || 0
          }));
          setSeverityData(mappedSeverityData);
        } else {
          throw new Error('Failed to fetch data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        log.error('Error fetching dashboard data:', err);
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    };

    fetchData();
  }, [activeFilters, isInitialLoad, timeRange]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-80 bg-gray-100 rounded"></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-80 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-red-500">Error loading dashboard: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleFilters}
              className="flex items-center gap-2 text-base font-medium text-blue-500 hover:text-blue-700"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="w-5 h-5"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {showFilters ? 'Clear Filters' : 'Filter Alerts'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          </div>
        </div>

        {showFilters && (
          <AlertFilters
            filters={filters}
            onFilterChange={onFilterChange}
            onSearch={onSearch}
            onClear={onClear}
            hasPendingChanges={hasPendingChanges}
            showFilters={showFilters}
            dimensions={dimensions}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Alerts by Policy {timeRange === '7days' ? '(Last 7 Days)' : timeRange === '30days' ? '(Last 30 Days)' : '(All Time)'}</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString();
                  }}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString();
                  }}
                  formatter={(value: number, name: string) => {
                    const policyName = dimensions.getLabel('policyId', name) || name;
                    return [value, policyName];
                  }}
                />
                <Legend 
                  formatter={(name: string) => dimensions.getLabel('policyId', name) || name}
                  onClick={handlePolicyLegendClick}
                  wrapperStyle={{ cursor: 'pointer' }}
                />
                {policyData.map((policy, index) => (
                  <Line
                    key={policy.name}
                    type="monotone"
                    dataKey={`counts.${policy.name}`}
                    name={policy.name}
                    stroke={COLORS[index % COLORS.length]}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Alerts by Severity {timeRange === '7days' ? '(Last 7 Days)' : timeRange === '30days' ? '(Last 30 Days)' : '(All Time)'}</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData} onClick={handleSeverityClick}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" style={{ cursor: 'pointer' }}>
                  {severityData.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={getSeverityColor(getSeverityLevels().find(level => level.name === entry.name)?.value || 0)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}