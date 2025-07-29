import { useState, useEffect, useCallback } from 'react';
import { DimensionsPayload, DimensionsParams, Dimension } from '@/app/api/v1/analytics/dimensions/route';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { log } from '@/lib/logging/console';

interface UseDimensionsOptions {
  dimensions: Dimension[];
  filters?: Omit<DimensionsParams, 'dimensions'>;
  autoFetch?: boolean;
}

interface DimensionOption {
  value: string;
  label: string;
}

export interface Dimensions {
  getLabel: (dimension: Dimension, value: string) => string | undefined;
  getValue: (dimension: Dimension, label: string) => string | undefined;
  getOptions: (dimension: Dimension) => DimensionOption[];
  getValues: (dimension: Dimension) => string[];
  getLabels: (dimension: Dimension) => string[];
  getMap: (dimension: Dimension) => Map<string, string>;
  getReverseMap: (dimension: Dimension) => Map<string, string>;
  getLabelsForValues: (dimension: Dimension, values: string[]) => string[];
  getValuesForLabels: (dimension: Dimension, labels: string[]) => string[];
  isValidValue: (dimension: Dimension, value: string) => boolean;
  isValidLabel: (dimension: Dimension, label: string) => boolean;
}

interface UseDimensionsResult {
  dimensions: Dimensions;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDimensions({ 
  dimensions: requestedDimensions, 
  filters = {}, 
  autoFetch = true 
}: UseDimensionsOptions): UseDimensionsResult {  
  const [dimensionData, setDimensionData] = useState<DimensionsPayload['data']>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDimensions = useCallback(async () => {
    log.debug('fetchDimensions created with:', { 
      requestedDimensions, 
      filters,
      requestedDimensionsRef: requestedDimensions === requestedDimensions,
      filtersRef: filters === filters
    });
    setIsLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      
      // Add dimensions to query params
      requestedDimensions.forEach(dim => searchParams.append('dimension', dim));

      // Add filters to query params
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });

      log.debug('Fetching dimensions with params:', searchParams.toString());
      const response = await fetch(`/api/v1/analytics/dimensions?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch dimensions');
      }

      const jsonResponse = await response.json();
      const dimensionsResponse = new JsonResponseFetch<DimensionsPayload>(jsonResponse, 'dimensions');
      
      if (dimensionsResponse.isSuccess()) {
        setDimensionData(dimensionsResponse.payload.data);
      } else {
        throw new Error(dimensionsResponse.message || 'Failed to get dimensions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      log.error('Error fetching dimensions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [requestedDimensions, filters]);

  useEffect(() => {
    log.debug('useEffect running with autoFetch:', autoFetch);
    if (autoFetch) {
      fetchDimensions();
    }
  }, [autoFetch]);

  const dimensions: Dimensions = {
    getLabel: (dimension: Dimension, value: string): string | undefined => {
      return dimensionData[dimension]?.find(item => item.value === value)?.label;
    },

    getValue: (dimension: Dimension, label: string): string | undefined => {
      return dimensionData[dimension]?.find(item => item.label === label)?.value;
    },

    getOptions: (dimension: Dimension): DimensionOption[] => {
      return dimensionData[dimension] || [];
    },

    getValues: (dimension: Dimension): string[] => {
      return dimensionData[dimension]?.map(item => item.value) || [];
    },

    getLabels: (dimension: Dimension): string[] => {
      return dimensionData[dimension]?.map(item => item.label) || [];
    },

    getMap: (dimension: Dimension): Map<string, string> => {
      return new Map(dimensionData[dimension]?.map(item => [item.value, item.label]) || []);
    },

    getReverseMap: (dimension: Dimension): Map<string, string> => {
      return new Map(dimensionData[dimension]?.map(item => [item.label, item.value]) || []);
    },

    getLabelsForValues: (dimension: Dimension, values: string[]): string[] => {
      const map = dimensions.getMap(dimension);
      return values.map(value => map.get(value) || value);
    },

    getValuesForLabels: (dimension: Dimension, labels: string[]): string[] => {
      const map = dimensions.getReverseMap(dimension);
      return labels.map(label => map.get(label) || label);
    },

    isValidValue: (dimension: Dimension, value: string): boolean => {
      return dimensionData[dimension]?.some(item => item.value === value) || false;
    },

    isValidLabel: (dimension: Dimension, label: string): boolean => {
      return dimensionData[dimension]?.some(item => item.label === label) || false;
    }
  };

  return {
    dimensions,
    isLoading,
    error,
    refresh: fetchDimensions
  };
}

// Re-export Dimension type for clients
export type { Dimension } from '@/app/api/v1/analytics/dimensions/route'; 