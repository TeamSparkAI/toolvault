import React, { useEffect, useState, useRef, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { MessageFilters } from '../messages/MessageFilters';
import { MessageData } from '@/lib/models/types/message';
import { MessageTimeSeriesPayload, MessageTimeSeriesData } from '@/app/api/v1/analytics/messages/timeSeries/route';
import { MessageAggregatePayload, MessageAggregateData } from '@/app/api/v1/analytics/messages/aggregate/route';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { fillTimeSeriesData, calculateTimeRange } from '@/app/lib/utils/timeSeries';
import { TimeRangeSelector } from '../charts/TimeRangeSelector';
import { MessageFilter } from '@/lib/models/types/message';
import { Dimensions } from '@/app/hooks/useDimensions';
import { useRouter } from 'next/navigation';
import { toggleFilterInUrl } from '@/app/lib/utils/urlParams';
import { log } from '@/lib/logging/console';

interface MessagesDashboardProps {
  filters: MessageFilter;
  onFilterChange: (field: keyof MessageFilter, value: string | number | undefined) => void;
  onSearch: () => void;
  onClear: () => void;
  hasPendingChanges: boolean;
  showFilters: boolean;
  onToggleFilters: () => void;
  activeFilters: MessageFilter;
  messages?: MessageData[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  sortDirection?: 'asc' | 'desc';
  onSort?: () => void;
  totalMessages?: number;
  dimensions: Dimensions;
  filtersInitialized?: boolean;
}

type TimeRange = '7days' | '30days' | 'all';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export function MessagesDashboard({
  filters,
  onFilterChange,
  onSearch,
  onClear,
  hasPendingChanges,
  showFilters,
  onToggleFilters,
  activeFilters,
  messages = [],
  isLoading: messagesLoading = false,
  hasMore = false,
  onLoadMore = () => {},
  sortDirection = 'desc',
  onSort = () => {},
  totalMessages,
  dimensions,
  filtersInitialized = false
}: MessagesDashboardProps) {
  const router = useRouter();
  const [timeSeriesData, setTimeSeriesData] = useState<MessageTimeSeriesData[]>([]);
  const [clientData, setClientData] = useState<Array<{ name: string; value: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [animationId, setAnimationId] = useState(0);
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const lastUpdateRef = useRef<number>(0);
  const renderCountRef = useRef(0);

  // Log renders
  useEffect(() => {
    renderCountRef.current += 1;
    log.debug('Component rendered:', {
      renderCount: renderCountRef.current,
      clientData,
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
      log.debug('Current state:', {
        clientData,
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
        queryParams.set('dimension', 'serverName');
        queryParams.set('timeUnit', 'day');
        if (timeRange !== 'all') {
          queryParams.set('startTime', startTime.toISOString());
        }
        queryParams.set('endTime', endTime.toISOString());

        // Add active filters
        Object.entries(activeFilters).forEach(([key, value]) => {
          if (value) queryParams.set(key, value);
        });

        const [timeSeriesResponse, clientResponse] = await Promise.all([
          fetch(`/api/v1/analytics/messages/timeSeries?${queryParams.toString()}`),
          fetch(`/api/v1/analytics/messages/aggregate?dimension=clientId&${queryParams.toString()}`)
        ]);

        const [timeSeriesJson, clientJson] = await Promise.all([
          timeSeriesResponse.json(),
          clientResponse.json()
        ]);

        const timeSeriesResult = new JsonResponseFetch<MessageTimeSeriesPayload>(timeSeriesJson, 'timeSeries');
        const clientResult = new JsonResponseFetch<MessageAggregatePayload>(clientJson, 'aggregate');

        if (!timeSeriesResult.isSuccess()) {
          throw new Error(`Time series request failed: ${timeSeriesResult.message}`);
        }

        if (!clientResult.isSuccess()) {
          throw new Error(`Client data request failed: ${clientResult.message}`);
        }

        const timeSeriesDataResult = timeSeriesResult.payload;
        const clientDataResult = clientResult.payload;

        if (!timeSeriesDataResult) {
          throw new Error('Invalid time series data format');
        }

        if (!clientDataResult) {
          throw new Error('Invalid client data format');
        }

        log.debug('Received new client data:', clientDataResult);
        log.debug('Current client data:', clientData);

        // Fill in missing days and update time series data
        const filledData = fillTimeSeriesData(timeSeriesDataResult.data, startTime, endTime, timeRange);
        setTimeSeriesData(filledData);
        
        // Create new client data
        const newClientData = clientDataResult.data.map((item: MessageAggregateData) => ({
          name: item.value,
          value: item.count
        }));
        
        // First trigger animation
        setAnimationId(prev => prev + 1);
        
        // Then update data after a small delay to ensure animation state is processed
        setTimeout(() => {
          setClientData(newClientData);
        }, 50);
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

  // Get unique server names from the time series data
  const serverNames = Array.from(new Set(
    timeSeriesData.flatMap(data => Object.keys(data.counts))
  ));

  // Handle legend click for server filtering
  const handleLegendClick = (entry: any) => {
    const serverName = entry.dataKey?.replace('counts.', '') || entry.value;
    if (serverName) {
      const newURL = toggleFilterInUrl('serverName', serverName, activeFilters.serverName);
      router.push(`/messages${newURL}`);
    }
  };

  // Handle pie chart click for client filtering
  const handlePieClick = (entry: any) => {
    if (entry && entry.name) {
      const newURL = toggleFilterInUrl('clientId', entry.name, activeFilters.clientId);
      router.push(`/messages${newURL}`);
    }
  };

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
            {showFilters ? 'Clear Filters' : 'Filter Messages'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {showFilters && (
        <MessageFilters
          filters={filters}
          onFilterChange={onFilterChange}
          onSearch={onSearch}
          onClear={onClear}
          hasPendingChanges={hasPendingChanges}
          showFilters={showFilters}
          dimensions={dimensions}
        />
      )}
      
      <div className="grid grid-cols-2 gap-6 relative">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Messages by Server {timeRange === '7days' ? '(Last 7 Days)' : timeRange === '30days' ? '(Last 30 Days)' : '(All Time)'}</h2>
          <div className="h-80">
            {!timeSeriesData.length ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                No data available for the selected time period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value: string) => {
                      const [year, month, day] = value.split('-').map(Number);
                      const date = new Date(Date.UTC(year, month - 1, day));
                      // Use UTC methods to avoid timezone conversion
                      const monthName = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
                      const dayNum = date.getUTCDate();
                      return `${monthName} ${dayNum}`;
                    }}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value: string) => {
                      const [year, month, day] = value.split('-').map(Number);
                      const date = new Date(Date.UTC(year, month - 1, day));
                      return date.toLocaleString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        timeZone: 'UTC'
                      });
                    }}
                  />
                  <Legend onClick={handleLegendClick} wrapperStyle={{ cursor: 'pointer' }} />
                  {serverNames.map((serverName, index) => (
                    <Line
                      key={serverName}
                      type="monotone"
                      dataKey={`counts.${serverName}`}
                      name={serverName}
                      stroke={COLORS[index % COLORS.length]}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Messages by Client {timeRange === '7days' ? '(Last 7 Days)' : timeRange === '30days' ? '(Last 30 Days)' : '(All Time)'}</h2>
          <div className="h-80">
            {!clientData.length ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                No data available for the selected time period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={clientData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }: { name: string; percent: number }) => {
                      const clientName = dimensions.getLabel('clientId', name) || name;
                      return `${clientName} (${(percent * 100).toFixed(0)}%)`;
                    }}
                    isAnimationActive={true}
                    animationDuration={800}
                    animationId={animationId}
                    onClick={handlePieClick}
                    style={{ cursor: 'pointer' }}
                  >
                    {clientData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => {
                    const clientName = dimensions.getLabel('clientId', name) || name;
                    return [`${clientName}: ${value}`];
                  }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 