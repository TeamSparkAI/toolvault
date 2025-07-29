import { useState, useEffect, useRef } from 'react';
import { MessageTimeSeriesData, MessageTimeSeriesPayload } from '@/app/api/v1/analytics/messages/timeSeries/route';
import { AlertTimeSeriesPayload } from '@/app/api/v1/analytics/alerts/timeSeries/route';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { fillTimeSeriesData, calculateTimeRange, TimeRange } from '@/app/lib/utils/timeSeries';
import { log } from '@/lib/logging/console';

interface UseTimeSeriesDataProps {
  dimension: string;
  timeRange: TimeRange;
  filters?: Record<string, string>;
}

export function useTimeSeriesData({ dimension, timeRange, filters = {} }: UseTimeSeriesDataProps) {
  const [data, setData] = useState<MessageTimeSeriesData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateRef.current;
      
      // Prevent too frequent updates
      if (timeSinceLastUpdate < 500) {
        return;
      }
      
      lastUpdateRef.current = now;
      
      // Only show loading state on initial load
      if (isInitialLoad) {
        setIsLoading(true);
      }
      setError(null);

      try {
        log.debug('Fetching time series data with params:', { dimension, timeRange, filters });
        
        // Calculate time range
        const { startTime, endTime } = calculateTimeRange(timeRange);

        const queryParams = new URLSearchParams();
        queryParams.set('dimension', dimension);
        queryParams.set('timeUnit', 'day');
        if (timeRange !== 'all') {
          queryParams.set('startTime', startTime.toISOString());
        }
        queryParams.set('endTime', endTime.toISOString());

        // Add filters
        Object.entries(filters).forEach(([key, value]) => {
          if (value) queryParams.set(key, value);
        });

        // Use alerts endpoint for policyId dimension, otherwise use messages endpoint
        const endpoint = dimension === 'policyId' ? 'alerts' : 'messages';
        const url = `/api/v1/analytics/${endpoint}/timeSeries?${queryParams.toString()}`;
        log.debug('Fetching from URL:', url);

        const response = await fetch(url);
        log.debug('Response status:', response.status);
        
        const json = await response.json();
        log.debug('Response data:', json);
        
        const result = new JsonResponseFetch<MessageTimeSeriesPayload | AlertTimeSeriesPayload>(json, 'timeSeries');

        if (!result.isSuccess()) {
          throw new Error(`Time series request failed: ${result.message}`);
        }

        const rawData = result.payload?.data || [];
        log.debug('Raw time series data:', rawData);

        // Fill in missing data points
        const filledData = fillTimeSeriesData(rawData, startTime, endTime, timeRange);
        log.debug('Filled time series data:', filledData);
        
        // Update data immediately
        setData(filledData);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch time series data';
        log.error('Error fetching time series data:', err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    };

    fetchData();
  }, [dimension, timeRange, JSON.stringify(filters), isInitialLoad]);

  return { data, isLoading, error };
} 