import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/app/hooks/useDialog';
import { ClientServerRelationshipWithClient } from '@/app/api/v1/servers/[serverId]/clients/route';
import { useCompliance } from '@/app/contexts/ComplianceContext';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { getClientIcon } from '@/lib/client-icons';
import { SyncResponse } from '@/lib/services/clientSyncService';
import { Client } from '@/lib/models/types/client';

interface ServerClientsTabProps {
  serverId: number;
  server?: {
    security?: string | null;
  };
}

export function ServerClientsTab({ serverId, server }: ServerClientsTabProps) {
  const [relationships, setRelationships] = useState<ClientServerRelationshipWithClient[]>([]);
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
  const { alert, confirm } = useDialog();
  const router = useRouter();
  const { triggerRefresh } = useCompliance();

  useEffect(() => {
    loadData();
  }, [serverId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load server-client relationships
      const relationshipsResponse = await fetch(`/api/v1/servers/${serverId}/clients`);
      if (!relationshipsResponse.ok) {
        throw new Error('Failed to load server-client relationships');
      }
      const relationshipsData = new JsonResponseFetch<ClientServerRelationshipWithClient[]>(
        await relationshipsResponse.json(),
        'relationships'
      );
      if (!relationshipsData.isSuccess()) {
        throw new Error(relationshipsData.message || 'Failed to load relationships');
      }
      setRelationships(relationshipsData.payload);

      // Load all available clients
      const clientsResponse = await fetch('/api/v1/clients');
      if (!clientsResponse.ok) {
        throw new Error('Failed to load clients');
      }
      const clientsData = await clientsResponse.json();
      setAvailableClients(clientsData.clients);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = async () => {
    if (selectedClientIds.length === 0) {
      await alert('Please select at least one client', 'Missing Information');
      return;
    }

    try {
      const response = await fetch(`/api/v1/servers/${serverId}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(selectedClientIds),
      });

      if (!response.ok) {
        throw new Error('Failed to add clients to server');
      }

      await loadData();
      setShowAddModal(false);
      setSelectedClientIds([]);
      
      // Trigger compliance refresh since adding clients affects compliance
      triggerRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add clients');
    }
  };

  const handlePushAll = async () => {
    // Find all relationships that have pending operations AND are linked (have configPath)
    const pushableRelationships = relationships.filter(relationship => 
      relationship.client?.configPath && (
        relationship.syncState === 'add' || 
        relationship.syncState === 'deleteScanned' || 
        relationship.syncState === 'deletePushed'
      )
    );

    if (pushableRelationships.length === 0) {
      await alert('No pending operations to push', 'No Operations');
      return;
    }

    const confirmed = await confirm(
      `Are you sure you want to push ${pushableRelationships.length} pending operation${pushableRelationships.length === 1 ? '' : 's'}?`,
      'Push All Operations'
    );

    if (!confirmed) return;

    try {
      // Push each pushable operation individually
      for (const relationship of pushableRelationships) {
        await handlePushClient(relationship.clientId);
      }

      await loadData();
      
      // Trigger compliance refresh since sync operations affect compliance
      triggerRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push all operations');
    }
  };
  
  const handlePushClient = async (clientId: number) => {
    try {
      const response = await fetch(`/api/v1/clients/${clientId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scan: false,
          import: false,
          convert: false,
          update: true,
          serverId: serverId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to push client');
      }

      const data = await response.json();
      const syncData = new JsonResponseFetch<SyncResponse>(data, 'sync');
      
      if (!syncData.isSuccess()) {
        throw new Error(syncData.message || 'Push failed');
      }

      await loadData();
      
      // Trigger compliance refresh since sync operations affect compliance
      triggerRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push client');
    }
  };

  const handleImportClient = async (clientId: number, clientName: string) => {
    const confirmed = await confirm(
      `Are you sure you want to import client "${clientName}"? This will convert the unmanaged client to managed.`,
      'Import Client'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/v1/clients/${clientId}/servers/${serverId}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to import client');
      }

      const data = await response.json();
      if (data.convert?.success) {
        await loadData();
        
        // Trigger compliance refresh since import operations affect compliance
        triggerRefresh();
      } else {
        throw new Error(data.convert?.message || 'Import failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import client');
    }
  };

  const handleUndoAdd = async (clientId: number, clientName: string) => {
    const confirmed = await confirm(
      `Are you sure you want to undo adding client "${clientName}"? This will remove the relationship.`,
      'Undo Add'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/v1/servers/${serverId}/clients/${clientId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to undo add client');
      }

      await loadData();
      
      // Trigger compliance refresh since relationship changes affect compliance
      triggerRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to undo add client');
    }
  };

  const handleUndoDelete = async (clientId: number, clientName: string) => {
    const confirmed = await confirm(
      `Are you sure you want to undo deleting client "${clientName}"? This will restore the relationship.`,
      'Undo Delete'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/v1/servers/${serverId}/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to undo delete client');
      }

      await loadData();
      
      // Trigger compliance refresh since relationship changes affect compliance
      triggerRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to undo delete client');
    }
  };

  const handleDeleteClient = async (clientId: number, clientName: string, autoUpdate?: boolean) => {
    const removalNote = autoUpdate ? '' : ' This will mark it for removal.';
    const confirmed = await confirm(
      `Are you sure you want to remove client "${clientName}" from this server?${removalNote}`,
      'Remove Client'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/v1/servers/${serverId}/clients/${clientId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete client from server');
      }

      await loadData();
      
      // Trigger compliance refresh since relationship changes affect compliance
      triggerRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete client');
    }
  };

  const getSyncStatus = (relationship: ClientServerRelationshipWithClient) => {
    switch (relationship.syncState) {
      case 'add':
        return { status: 'Pending Add' as const, icon: '+' };
      case 'deleteScanned':
      case 'deletePushed':
        return { status: 'Pending Delete' as const, icon: '-' };
      case 'pushed':
      case 'scanned':
      default:
        return { status: 'Up to Date' as const, icon: '✓' };
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading clients...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add button */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Clients</h2>
        <div className="flex space-x-3">
          {relationships.some(relationship => 
            relationship.client?.configPath && (
              relationship.syncState === 'add' || 
              relationship.syncState === 'deleteScanned' || 
              relationship.syncState === 'deletePushed'
            )
          ) && (
            <button
              onClick={handlePushAll}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              Push All
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add Client
          </button>
        </div>
      </div>

      {/* Clients List */}
      {relationships.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No clients configured for this server
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SYNC
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  NAME ON CLIENT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {relationships.map((relationship) => (
                <tr 
                  key={relationship.clientServerId}
                  onClick={() => router.push(`/clients/${relationship.clientId}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img 
                        src={getClientIcon(relationship.client?.type || 'generic')} 
                        alt={`${relationship.client?.type || 'generic'} icon`} 
                        className="w-6 h-6 mr-3"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {relationship.client?.name || 'Unknown Client'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium mr-2 ${
                        !relationship.client?.configPath
                          ? 'bg-yellow-100 text-yellow-800'
                          : getSyncStatus(relationship).status === 'Pending Add' 
                          ? 'bg-blue-100 text-blue-800' 
                          : getSyncStatus(relationship).status === 'Pending Delete'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {!relationship.client?.configPath ? '!' : getSyncStatus(relationship).icon}
                      </span>
                      <span className="text-sm text-gray-900">
                        {!relationship.client?.configPath ? 'Unlinked' : getSyncStatus(relationship).status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {relationship.client?.type || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {relationship.clientServerName && relationship.clientServerName.trim() !== '' ? (
                      relationship.clientServerName
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Not Deployed
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      relationship.client?.enabled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {relationship.client?.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      {!relationship.client?.configPath ? (
                        // For unlinked clients, only show Undo Add action
                        getSyncStatus(relationship).status === 'Pending Add' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUndoAdd(relationship.clientId, relationship.client?.name || 'Unknown');
                            }}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            Undo
                          </button>
                        )
                      ) : (
                        // For linked clients, show all actions
                        <>
                          {getSyncStatus(relationship).status === 'Up to Date' ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClient(relationship.clientId, relationship.client?.name || 'Unknown', relationship.client?.autoUpdate);
                                }}
                                className="text-red-600 hover:text-red-900"
                              >
                                Remove
                              </button>
                              {server?.security === 'unmanaged' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleImportClient(relationship.clientId, relationship.client?.name || 'Unknown');
                                  }}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  Import
                                </button>
                              )}
                            </>
                          ) : getSyncStatus(relationship).status === 'Pending Delete' ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUndoDelete(relationship.clientId, relationship.client?.name || 'Unknown');
                                }}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                Undo
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePushClient(relationship.clientId);
                                }}
                                className="text-green-600 hover:text-green-900"
                              >
                                Push
                              </button>
                            </>
                          ) : getSyncStatus(relationship).status === 'Pending Add' ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUndoAdd(relationship.clientId, relationship.client?.name || 'Unknown');
                                }}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                Undo
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePushClient(relationship.clientId);
                                }}
                                className="text-green-600 hover:text-green-900"
                              >
                                Push
                              </button>
                            </>
                          ) : null}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Clients to Server</h3>
            
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const availableClientsFiltered = availableClients.filter(
                  client => client.type !== 'ttv' && !relationships.some(r => r.clientId === client.clientId)
                );
                
                if (availableClientsFiltered.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      <p>No clients available to add.</p>
                      <p className="text-sm mt-2">All clients are already associated with this server.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 mb-3">
                      Select one or more clients to add to this server:
                    </p>
                    {availableClientsFiltered.map(client => (
                      <div
                        key={client.clientId}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          selectedClientIds.includes(client.clientId)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => {
                          setSelectedClientIds(prev => 
                            prev.includes(client.clientId)
                              ? prev.filter(id => id !== client.clientId)
                              : [...prev, client.clientId]
                          );
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={selectedClientIds.includes(client.clientId)}
                              onChange={() => {}} // Handled by parent div onClick
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div className="flex items-center">
                              <img 
                                src={getClientIcon(client.type)} 
                                alt={`${client.type} icon`} 
                                className="w-10 h-10 mr-2"
                              />
                              <div>
                                <div className="font-medium text-gray-900">
                                  {client.name}
                                  <span className="text-gray-500 font-normal">
                                    {' '}({client.type})
                                  </span>
                                </div>
                                <div className="text-sm text-gray-500">
                                  {client.description || 'No description available'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t">
              <div className="text-sm text-gray-600">
                {selectedClientIds.length > 0 
                  ? `${selectedClientIds.length} client${selectedClientIds.length === 1 ? '' : 's'} selected`
                  : 'No clients selected'
                }
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedClientIds([]);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddClient}
                  disabled={selectedClientIds.length === 0}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Add Client{selectedClientIds.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 