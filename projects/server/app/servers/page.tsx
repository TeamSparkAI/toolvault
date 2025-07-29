'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSecurityType } from '@/lib/utils/security';
import { Server } from '@/lib/types/server';
import { useLayout } from '@/app/contexts/LayoutContext';
import { StatusBadge } from '@/app/components/common/StatusBadge';
import { SecurityBadge } from '@/app/components/common/SecurityBadge';
import { SecurityStatusBadge } from '@/app/components/common/SecurityStatusBadge';
import { getServerIconUrl } from '@/lib/utils/githubImageUrl';

export default function ServersPage() {
  const router = useRouter();
  const { setHeaderAction } = useLayout();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<'name' | 'serverInfo' | 'security' | 'status' | 'lastSeen'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    setHeaderAction(
      <div className="flex gap-2">
        <button
          onClick={() => {
            router.push('/servers/new');
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Server
        </button>
        <button
          onClick={() => {
            router.push('/catalog');
          }}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Server Catalog
        </button>
      </div>
    );

    return () => setHeaderAction(null);
  }, [setHeaderAction, router]);

  const loadServers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/servers?managed=true');
      if (!response.ok) {
        throw new Error('Failed to load servers');
      }
      const data = await response.json();
      setServers(data.servers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load servers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  const handleServerClick = (serverId: number) => {
    router.push(`/servers/${serverId}`);
  };

  // Sorting logic
  const sortedServers = [...servers].sort((a, b) => {
    let aValue, bValue;
    switch (sortColumn) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'serverInfo':
        aValue = (a.status.serverInfo?.name || '').toLowerCase() + (a.status.serverInfo?.version || '').toLowerCase();
        bValue = (b.status.serverInfo?.name || '').toLowerCase() + (b.status.serverInfo?.version || '').toLowerCase();
        break;
      case 'security':
        aValue = getSecurityType(a.config, a.security) || '';
        bValue = getSecurityType(b.config, b.security) || '';
        break;
      case 'status':
        aValue = a.enabled ? 1 : 0;
        bValue = b.enabled ? 1 : 0;
        break;
      case 'lastSeen':
        aValue = a.status.lastSeen || '';
        bValue = b.status.lastSeen || '';
        break;
      default:
        aValue = '';
        bValue = '';
    }
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    // Secondary sort by name (ascending, case-insensitive)
    if (sortColumn !== 'name') {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      if (aName < bName) return -1;
      if (aName > bName) return 1;
    }
    return 0;
  });

  const handleSort = (column: 'name' | 'serverInfo' | 'security' | 'status' | 'lastSeen') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
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
      {loading ? (
        <div>Loading servers...</div>
      ) : (
        <div className="bg-white shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('name')}>
                  Name {sortColumn === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('serverInfo')}>
                  Server Info {sortColumn === 'serverInfo' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('security')}>
                  Security {sortColumn === 'security' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('status')}>
                  Status {sortColumn === 'status' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('lastSeen')}>
                  Last Seen {sortColumn === 'lastSeen' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedServers.map((server) => {
                const securityType = getSecurityType(server.config, server.security);
                return (
                  <tr
                    key={server.serverId || 'unknown'}
                    onClick={() => server.serverId && handleServerClick(server.serverId)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <img src={getServerIconUrl(server)} alt="MCP" style={{ display: 'inline', width: 20, height: 20, marginRight: 8, verticalAlign: 'middle' }} />
                      {server.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {server.status.serverInfo?.name
                        ? `${server.status.serverInfo.name} (${server.status.serverInfo.version || '-'})`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <SecurityBadge securityType={securityType} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <SecurityStatusBadge 
                        isUnmanaged={securityType === 'unmanaged'}
                        enabled={server.enabled}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {server.status.lastSeen
                        ? new Date(server.status.lastSeen).toLocaleString()
                        : 'Never'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 