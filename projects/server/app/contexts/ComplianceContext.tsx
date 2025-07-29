'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import type { ComplianceData as ApiComplianceData, ClientComplianceData } from '@/app/api/v1/compliance/route';
import { ClientType } from '@/lib/types/clientType';

interface ComplianceIssue {
  client: {
    clientId: number;
    name: string;
    type: ClientType;
  };
  issues: string[];
  status: 'compliant' | 'warning' | 'error';
}

interface ProcessedComplianceData {
  systemCompliance: {
    requireClientToken: boolean;
    strictServerAccess: boolean;
  };
  clientCompliance: ComplianceIssue[];
}

interface ComplianceContextType {
  complianceData: ProcessedComplianceData | null;
  complianceCount: number;
  isLoading: boolean;
  error: string | null;
  refreshCompliance: () => Promise<void>;
  triggerRefresh: () => void;
}

const ComplianceContext = createContext<ComplianceContextType | undefined>(undefined);

export function ComplianceProvider({ children }: { children: React.ReactNode }) {
  const [complianceData, setComplianceData] = useState<ProcessedComplianceData | null>(null);
  const [complianceCount, setComplianceCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const fetchComplianceDataRef = useRef<() => Promise<void>>();

  const fetchComplianceData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch compliance data from the new API endpoint
      const response = await fetch('/api/v1/compliance');
      if (!response.ok) {
        throw new Error('Failed to fetch compliance data');
      }
      const data = await response.json();
      const complianceResponse = new JsonResponseFetch<ApiComplianceData>(data, 'compliance');
      if (!complianceResponse.isSuccess()) {
        throw new Error(complianceResponse.message || 'Failed to fetch compliance data');
      }

      const rawComplianceData = complianceResponse.payload;

      // Process the raw compliance data into the display format
      const systemCompliance = {
        requireClientToken: rawComplianceData.systemCompliance.requireClientToken,
        strictServerAccess: rawComplianceData.systemCompliance.strictServerAccess,
      };

      // Process client compliance data with new severity logic
      const clientCompliance: ComplianceIssue[] = rawComplianceData.clientCompliance.map((clientData: ClientComplianceData) => {
        const issues: string[] = [];
        let hasError = false;
        let hasWarning = false;

        // ERROR SEVERITY: Client Configuration (no config OR never scanned)
        if (!clientData.isLinked || !clientData.lastScannedAt) {
          if (!clientData.isLinked) {
            issues.push('Unlinked client - no configuration path set');
          }
          if (!clientData.lastScannedAt) {
            issues.push('Never scanned');
          }
          hasError = true;
        }

        // ERROR SEVERITY: Server Security
        if (clientData.hasUnmanagedServers) {
          issues.push('Has unmanaged servers');
          hasError = true;
        }
        if (clientData.hasNonSecureServers) {
          issues.push('Has non-secure servers');
          hasError = true;
        }

        // WARNING SEVERITY: Regular Scanning (not within 30 days)
        if (clientData.lastScannedAt) {
          const lastScannedDate = new Date(clientData.lastScannedAt);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          if (lastScannedDate < thirtyDaysAgo) {
            issues.push('Not scanned within 30 days');
            hasWarning = true;
          }
        }

        // WARNING SEVERITY: Pending Operations
        if (clientData.hasPendingOperations) {
          issues.push('Has pending sync operations');
          hasWarning = true;
        }

        // Determine status based on severity
        let status: 'compliant' | 'warning' | 'error' = 'compliant';
        if (hasError) {
          status = 'error';
        } else if (hasWarning) {
          status = 'warning';
        }

        return {
          client: {
            clientId: clientData.clientId,
            name: clientData.name,
            type: clientData.type,
          },
          status,
          issues,
        };
      });

      const newComplianceData: ProcessedComplianceData = {
        systemCompliance,
        clientCompliance,
      };

      setComplianceData(newComplianceData);

      // Calculate compliance count (non-compliant items)
      const systemIssues = [newComplianceData.systemCompliance.requireClientToken, newComplianceData.systemCompliance.strictServerAccess]
        .filter(setting => !setting).length;
      const clientIssues = clientCompliance.filter(c => c.status !== 'compliant').length;
      setComplianceCount(systemIssues + clientIssues);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch compliance data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Store the function in a ref so it can be used in useEffect without dependencies
  fetchComplianceDataRef.current = fetchComplianceData;

  // Initial load
  useEffect(() => {
    fetchComplianceData();
  }, []); // Only run on mount

  const triggerRefresh = useCallback(() => {
    fetchComplianceData();
  }, [fetchComplianceData]);



  return (
    <ComplianceContext.Provider value={{ 
      complianceData, 
      complianceCount, 
      isLoading, 
      error, 
      refreshCompliance: fetchComplianceData, 
      triggerRefresh
    }}>
      {children}
    </ComplianceContext.Provider>
  );
}

export function useCompliance() {
  const context = useContext(ComplianceContext);
  if (context === undefined) {
    throw new Error('useCompliance must be used within a ComplianceProvider');
  }
  return context;
} 