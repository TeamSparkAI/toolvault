'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { log } from '@/lib/logging/console';

interface AggregateResult {
  value: string;
  count: number;
}

interface AlertAggregatePayload {
  data: AggregateResult[];
}

interface UnseenAlertsState {
  total: number;
  bySeverity: {
    [key: string]: number;
  };
  isLoading: boolean;
  error: string | null;
}

interface AlertsContextType {
  unseenAlerts: UnseenAlertsState;
  refreshUnseenAlerts: () => Promise<void>;
  getUnseenAlertsCount: (filters: { clientId?: number; serverId?: number; policyId?: number }) => Promise<number>;
  refreshCounter: number;
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const [unseenAlerts, setUnseenAlerts] = useState<UnseenAlertsState>({
    total: 0,
    bySeverity: {},
    isLoading: true,
    error: null
  });
  const [refreshCounter, setRefreshCounter] = useState<number>(0);

  const fetchUnseenCounts = useCallback(async () => {
    try {
      setUnseenAlerts(prev => ({ ...prev, isLoading: true, error: null }));
      
      log.debug('[AlertsContext] Fetching unseen alerts');
      const response = await fetch('/api/v1/analytics/alerts/aggregate?dimension=severity&seen=false');
      const data = await response.json();
      
      const result = new JsonResponseFetch<AlertAggregatePayload>(data, 'aggregate');
      
      if (!result.isSuccess()) {
        throw new Error(result.message || 'Failed to fetch unseen alerts');
      }

      const payload = result.payload;
      const bySeverity: { [key: string]: number } = {};
      let total = 0;

      payload.data.forEach((item: AggregateResult) => {
        bySeverity[item.value] = item.count;
        total += item.count;
      });

      setUnseenAlerts({
        total,
        bySeverity,
        isLoading: false,
        error: null
      });
      setRefreshCounter(prev => prev + 1);
    } catch (error) {
      setUnseenAlerts(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch unseen alerts'
      }));
    }
  }, []);

  const getUnseenAlertsCount = useCallback(async (filters: { clientId?: number; serverId?: number; policyId?: number }) => {
    try {
      const params = new URLSearchParams();
      params.append('dimension', 'severity');
      params.append('seen', 'false');
      
      if (filters.clientId) params.append('clientId', filters.clientId.toString());
      if (filters.serverId) params.append('serverId', filters.serverId.toString());
      if (filters.policyId) params.append('policyId', filters.policyId.toString());
      
      const response = await fetch(`/api/v1/analytics/alerts/aggregate?${params.toString()}`);
      const data = await response.json();
      
      const result = new JsonResponseFetch<AlertAggregatePayload>(data, 'aggregate');
      
      if (!result.isSuccess()) {
        throw new Error(result.message || 'Failed to fetch unseen alerts count');
      }

      const payload = result.payload;
      let total = 0;

      payload.data.forEach((item: AggregateResult) => {
        total += item.count;
      });

      return total;
    } catch (error) {
      log.error('[AlertsContext] Error fetching unseen alerts count:', error);
      return 0;
    }
  }, []);

  useEffect(() => {
    fetchUnseenCounts();
  }, [fetchUnseenCounts]);

  return (
    <AlertsContext.Provider value={{ unseenAlerts, refreshUnseenAlerts: fetchUnseenCounts, getUnseenAlertsCount, refreshCounter }}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertsContext);
  if (context === undefined) {
    throw new Error('useAlerts must be used within an AlertsProvider');
  }
  return context;
} 