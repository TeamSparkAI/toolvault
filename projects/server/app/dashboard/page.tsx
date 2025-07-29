'use client';

import { useState, useEffect } from 'react';
import { HostData } from '@/lib/models/types/host';
import EditHostModal from '@/app/components/EditHostModal';
import { useModal } from '@/app/contexts/ModalContext';
import { useLayout } from '@/app/contexts/LayoutContext';
import { DashboardChart } from '@/app/components/dashboard/DashboardChart';
import { NewAlertsSummary } from '@/app/components/alerts/NewAlertsSummary';
import { useDimensions } from '@/app/hooks/useDimensions';
import { useRouter } from 'next/navigation';
import { log } from '@/lib/logging/console';

interface DashboardStats {
  servers: {
    total: number;
    active: number;
  };
  clients: {
    total: number;
    disabled: number;
  };
  policies: {
    total: number;
    alerts: number;
  };
}

interface BridgeStatus {
  running: boolean;
  configuration?: {
    host?: {
      mode: string;
      host?: string;
      port: number;
    } | null;
    actualPort?: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    servers: { total: 0, active: 0 },
    clients: { total: 0, disabled: 0 },
    policies: { total: 0, alerts: 0 }
  });
  const [hostConfig, setHostConfig] = useState<HostData | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  const [isUpdatingBridge, setIsUpdatingBridge] = useState(false);
  const { setModalContent } = useModal();
  const { setHeaderTitle } = useLayout();
  const { dimensions } = useDimensions({
    dimensions: ['serverName', 'policyId']
  });
  const router = useRouter();

  useEffect(() => {
    // Set the header title
    setHeaderTitle('Dashboard');
    // Cleanup function to reset header title when component unmounts
    return () => setHeaderTitle(undefined);
  }, [setHeaderTitle]);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch servers
        const serversRes = await fetch('/api/v1/servers?managed=true');
        const serversData = await serversRes.json();
        const servers = serversData.servers || [];
        const totalServers = servers.length;
        const activeServers = servers.filter((s: any) => s.enabled).length;

        // Fetch clients
        const clientsRes = await fetch('/api/v1/clients');
        const clientsData = await clientsRes.json();
        const clients = clientsData.clients || [];
        const activeClients = clients.filter((c: any) => c.enabled).length;
        const totalClients = clients.length;
        const disabledClients = totalClients - activeClients;

        // Try to fetch policies, but handle 404 gracefully
        let totalPolicies = 0;
        let totalAlerts = 0;
        try {
          const policiesRes = await fetch('/api/v1/policies');
          if (policiesRes.status === 404) {
            // Endpoint doesn't exist, just use 0s
            totalPolicies = 0;
            totalAlerts = 0;
          } else {
            const policiesData = await policiesRes.json();
            const policies = policiesData.policies || [];
            totalPolicies = policies.length;
            totalAlerts = policies.reduce((sum: number, p: any) => sum + (p.status?.unseenAlerts || 0), 0);
          }
        } catch (err) {
          // If fetch fails for any other reason, just use 0s for policies
          totalPolicies = 0;
          totalAlerts = 0;
        }

        setStats({
          servers: { total: totalServers, active: activeServers },
          clients: { total: activeClients, disabled: disabledClients },
          policies: { total: totalPolicies, alerts: totalAlerts }
        });
      } catch (err) {
        // fallback to 0s if any error
        setStats({
          servers: { total: 0, active: 0 },
          clients: { total: 0, disabled: 0 },
          policies: { total: 0, alerts: 0 }
        });
      }
    }
    fetchStats();
    loadHostConfig();
    loadBridgeStatus();
  }, []);

  const loadHostConfig = async () => {
    try {
      log.info('Loading host configuration...');
      const response = await fetch('/api/v1/host');
      if (!response.ok) {
        throw new Error('Failed to load host configuration');
      }
      const data = await response.json();
      log.info('Received host configuration:', data);
      setHostConfig(data);
    } catch (err) {
      log.error('Error loading host configuration:', err);
    }
  };

  const loadBridgeStatus = async () => {
    try {
      const response = await fetch('/api/v1/bridge/status');
      if (!response.ok) {
        throw new Error('Failed to load bridge status');
      }
      const data = await response.json();
      setBridgeStatus(data.status);
    } catch (err) {
      log.error('Error loading bridge status:', err);
    }
  };

  const handleBridgeControl = async (start: boolean) => {
    setIsUpdatingBridge(true);
    try {
      const endpoint = start ? '/api/v1/bridge/start' : '/api/v1/bridge/stop';
      const response = await fetch(endpoint, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Failed to ${start ? 'start' : 'stop'} bridge`);
      }
      await loadBridgeStatus();
    } catch (err) {
      log.error(`Error ${start ? 'starting' : 'stopping'} bridge:`, err);
    } finally {
      setIsUpdatingBridge(false);
    }
  };

  const handleSaveHost = async (config: HostData) => {
    try {
      const response = await fetch('/api/v1/host', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        throw new Error('Failed to save host configuration');
      }
      await loadHostConfig();
    } catch (err) {
      log.error('Error saving host configuration:', err);
    }
  };

  const handleEditHost = () => {
    setModalContent(
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <EditHostModal
          host={hostConfig}
          onSave={(host) => {
            handleSaveHost(host);
            setModalContent(null);
          }}
          onCancel={() => setModalContent(null)}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <NewAlertsSummary showSeparator={false} showReviewLink={true} />

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-900 flex-1">Gateway Host</h3>
            <a
              href="/settings"
              className="text-blue-500 text-sm hover:underline ml-2"
            >
              Manage
            </a>
          </div>
          <div className="mt-2">
            {hostConfig ? (
              <div className="space-y-1">

                <div className="flex items-center text-sm text-gray-500">
                  {hostConfig.host ? (
                    <span>Host: {hostConfig.host}:{bridgeStatus?.configuration?.actualPort || hostConfig.port}</span>
                  ) : (
                    <span>Port: {bridgeStatus?.configuration?.actualPort || hostConfig.port}</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className={`font-medium ${bridgeStatus?.running ? 'text-green-600' : 'text-red-600'}`}>
                    {bridgeStatus?.running ? 'Running' : 'Stopped'}
                  </span>
                  <button
                    className={`ml-2 p-1.5 rounded-full border border-gray-300 hover:bg-gray-100 text-gray-600 transition-colors relative group ${isUpdatingBridge ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => handleBridgeControl(!bridgeStatus?.running)}
                    disabled={isUpdatingBridge}
                  >
                    {bridgeStatus?.running ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <rect x="5" y="5" width="10" height="10" rx="2" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity delay-300 whitespace-nowrap">
                      {bridgeStatus?.running ? 'Stop Host' : 'Start Host'}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No host configuration</p>
            )}
          </div>
        </div>
        <div 
          className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push('/servers')}
        >
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-900 flex-1">Servers</h3>
            <a
              href="/servers"
              className="text-blue-500 text-sm hover:underline ml-2"
              onClick={(e) => e.stopPropagation()}
            >
              Manage
            </a>
          </div>
          <div className="mt-2">
            <div className="flex flex-col items-start">
              <span className="text-3xl font-semibold text-gray-900">{stats.servers.active}</span>
              <span className="text-sm text-gray-500">Active</span>
              {stats.servers.total > stats.servers.active && (
                <span className="text-xs text-gray-400 mt-1">{stats.servers.total - stats.servers.active} disabled</span>
              )}
            </div>
          </div>
        </div>
        <div 
          className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push('/clients')}
        >
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-900 flex-1">Clients</h3>
            <a
              href="/clients"
              className="text-blue-500 text-sm hover:underline ml-2"
              onClick={(e) => e.stopPropagation()}
            >
              Manage
            </a>
          </div>
          <div className="mt-2">
            <div className="flex flex-col items-start">
              <span className="text-3xl font-semibold text-gray-900">{stats.clients.total}</span>
              <span className="text-sm text-gray-500">Active</span>
              {stats.clients.disabled > 0 && (
                <span className="text-xs text-gray-400 mt-1">{stats.clients.disabled} disabled</span>
              )}
            </div>
          </div>
        </div>
        <div 
          className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push('/policies')}
        >
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-900 flex-1">Policies</h3>
            <a
              href="/policies"
              className="text-blue-500 text-sm hover:underline ml-2"
              onClick={(e) => e.stopPropagation()}
            >
              Manage
            </a>
          </div>
          <div className="mt-2">
            <div className="flex flex-col items-start">
              <span className="text-3xl font-semibold text-gray-900">{stats.policies.total}</span>
              <span className="text-sm text-gray-500">Active</span>
              {/* If you add enabled/disabled logic for policies, show disabled here */}
              {stats.policies.alerts > 0 && (
                <span className="text-xs text-red-500 mt-1">{stats.policies.alerts} unread alerts</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Message Activity Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <DashboardChart 
          dimension="serverName"
          timeRange="7days"
          dimensions={dimensions}
        />
      </div>

      {/* Alerts Chart */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <DashboardChart 
            dimension="policyId"
            timeRange="7days"
            dimensions={dimensions}
          />
        </div>
      </div>
    </div>
  );
} 