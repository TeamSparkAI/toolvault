'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLayout } from '@/app/contexts/LayoutContext';
import { useDialog } from '@/app/hooks/useDialog';
import { getClientIcon } from '@/lib/client-icons';
import { StatusBadge } from '@/app/components/common/StatusBadge';
import { Client } from '@/lib/models/types/client';

export default function ClientsPage() {
  const router = useRouter();
  const { setHeaderAction } = useLayout();
  const { alert } = useDialog();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<'name' | 'type' | 'status' | 'lastUpdated' | 'lastScanned'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    setHeaderAction(
      <div className="flex gap-2">
        <button
          onClick={() => {
            router.push('/clients/new');
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Client
        </button>
        <button
          onClick={() => {
            router.push('/clients/discover');
          }}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Discover Clients
        </button>
      </div>
    );

    return () => setHeaderAction(null);
  }, [setHeaderAction, router, alert]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/clients');
      if (!response.ok) {
        throw new Error('Failed to load clients');
      }
      const data = await response.json();
      setClients(data.clients);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleClientClick = (clientId: number) => {
    router.push(`/clients/${clientId}`);
  };

  // Sorting logic
  const sortedClients = [...clients].sort((a, b) => {
    let aValue, bValue;
    switch (sortColumn) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'type':
        aValue = a.type.toLowerCase();
        bValue = b.type.toLowerCase();
        break;
      case 'status':
        aValue = a.enabled ? 1 : 0;
        bValue = b.enabled ? 1 : 0;
        break;
      case 'lastUpdated':
        aValue = a.lastUpdated || '';
        bValue = b.lastUpdated || '';
        break;
      case 'lastScanned':
        aValue = a.lastScanned || '';
        bValue = b.lastScanned || '';
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

  const handleSort = (column: 'name' | 'type' | 'status' | 'lastUpdated' | 'lastScanned') => {
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
        <div>Loading clients...</div>
      ) : (
        <div className="bg-white shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('name')}>
                  Name {sortColumn === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('type')}>
                  Type {sortColumn === 'type' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('status')}>
                  Status {sortColumn === 'status' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('lastUpdated')}>
                  Last Updated {sortColumn === 'lastUpdated' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('lastScanned')}>
                  Last Scanned {sortColumn === 'lastScanned' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedClients.map((client) => (
                <tr
                  key={client.clientId}
                  onClick={() => client.clientId && handleClientClick(client.clientId)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <img 
                        src={getClientIcon(client.type)} 
                        alt={`${client.type} icon`} 
                        className="w-6 h-6"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{client.name}</div>
                        {client.description && (
                          <div className="text-sm text-gray-500">{client.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <StatusBadge enabled={client.enabled} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.lastUpdated ? new Date(client.lastUpdated).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.lastScanned ? new Date(client.lastScanned).toLocaleString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 