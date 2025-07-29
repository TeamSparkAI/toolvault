'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/app/hooks/useDialog';
import { ClientServerRelationshipWithServer } from '@/app/api/v1/clients/[clientId]/servers/route';
import { useCompliance } from '@/app/contexts/ComplianceContext';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { SyncResponse } from '@/lib/services/clientSyncService';
import { SecurityBadge } from '@/app/components/common/SecurityBadge';
import { SecurityStatusBadge } from '@/app/components/common/SecurityStatusBadge';
import { ManagedBadge } from '@/app/components/common/ManagedBadge';
import { ServerWithStatus } from '@/app/api/v1/servers/route';
import { Client } from '@/lib/models/types/client';
import { getServerIconUrl } from '@/lib/utils/githubImageUrl';
import { getServerDisplayInfo } from '@/lib/utils/serverDisplay';
import { ConvertServerDialog } from './ConvertServerDialog';
import { log } from '@/lib/logging/console';

interface ClientServersTabProps {
  client: Client & { clientId: number };
  onClientUpdated?: () => void;
}

export function ClientServersTab({ client, onClientUpdated }: ClientServersTabProps) {
  const [relationships, setRelationships] = useState<ClientServerRelationshipWithServer[]>([]);
  const [availableServers, setAvailableServers] = useState<ServerWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedServerIds, setSelectedServerIds] = useState<number[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConvertingAll, setIsConvertingAll] = useState(false);
  const { alert, confirm } = useDialog();
  const router = useRouter();
  const { triggerRefresh } = useCompliance();
  const [showConvertDialog, setShowConvertDialog] = useState<null | { type: 'single', serverId: number, serverName: string } | { type: 'bulk', count: number }>(null);

  useEffect(() => {
    loadData();
  }, [client.clientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load client-server relationships
      const relationshipsResponse = await fetch(`/api/v1/clients/${client.clientId}/servers`);
      if (!relationshipsResponse.ok) {
        throw new Error('Failed to load client-server relationships');
      }
      const relationshipsData = new JsonResponseFetch<ClientServerRelationshipWithServer[]>(
        await relationshipsResponse.json(),
        'relationships'
      );
      if (!relationshipsData.isSuccess()) {
        throw new Error(relationshipsData.message || 'Failed to load relationships');
      }
      setRelationships(relationshipsData.payload);

      // Load all available servers (enabled only)
      const serversResponse = await fetch('/api/v1/servers?managed=true&enabled=true');
      if (!serversResponse.ok) {
        throw new Error('Failed to load servers');
      }
      const serversData = new JsonResponseFetch<ServerWithStatus[]>(
        await serversResponse.json(),
        'servers'
      );
      if (!serversData.isSuccess()) {
        throw new Error(serversData.message || 'Failed to load servers');
      }
      setAvailableServers(serversData.payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddServer = async () => {
    if (selectedServerIds.length === 0) {
      await alert('Please select at least one server', 'Missing Information');
      return;
    }

    try {
      const response = await fetch(`/api/v1/clients/${client.clientId}/servers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(selectedServerIds),
      });

      if (!response.ok) {
        throw new Error('Failed to add servers to client');
      }

      await loadData();
      setShowAddModal(false);
      setSelectedServerIds([]);
      
      // Trigger compliance refresh since adding servers affects compliance
      triggerRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add servers');
    }
  };

  const handlePushAll = async () => {
    try {
      const response = await fetch(`/api/v1/clients/${client.clientId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scan: false,
          import: false,
          convert: false,
          update: true
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to push all servers');
      }

      const data = await response.json();
      const syncData = new JsonResponseFetch<SyncResponse>(data, 'sync');
      
      if (!syncData.isSuccess()) {
        throw new Error(syncData.message || 'Push all failed');
      }

      await loadData();
      
      // Trigger compliance refresh since sync operations affect compliance
      triggerRefresh();
      
      // Notify parent component that client data has been updated
      onClientUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push all servers');
    }
  };

  const handlePushServer = async (serverId: number | null, serverName: string) => {
    try {
      const response = await fetch(`/api/v1/clients/${client.clientId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scan: false,
          import: false,
          convert: false,
          update: true,
          serverIds: [serverId]
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to push server');
      }

      const data = await response.json();
      const syncData = new JsonResponseFetch<SyncResponse>(data, 'sync');
      
      if (!syncData.isSuccess()) {
        throw new Error(syncData.message || 'Push failed');
      }

      await loadData();
      
      // Trigger compliance refresh since sync operations affect compliance
      triggerRefresh();
      
      // Notify parent component that client data has been updated
      onClientUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push server');
    }
  };

  const handlePushRelationship = async (relationship: ClientServerRelationshipWithServer) => {
    if (!relationship.clientServerName) {
      throw new Error(`Cannot push relationship ${relationship.clientServerId}: no clientServerName set`);
    }
    await handlePushServer(
      relationship.serverId, 
      relationship.clientServerName
    );
  };

  const handleImportServer = (serverId: number, serverName: string) => {
    setShowConvertDialog({ type: 'single', serverId, serverName });
  };

  const handleConvertDialogConfirm = async (convertWrapping: boolean) => {
    if (!showConvertDialog) return;
    setShowConvertDialog(null);
    setError(null);
    if (showConvertDialog.type === 'single') {
      try {
        const response = await fetch(`/api/v1/clients/${client.clientId}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ convert: true, serverIds: [showConvertDialog.serverId], update: !!client.autoUpdate, convertWrapping }),
        });
        if (!response.ok) throw new Error('Failed to convert server');
        await loadData();
        
        // Trigger compliance refresh since conversion affects compliance
        triggerRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to convert server');
      }
    } else if (showConvertDialog.type === 'bulk') {
      setIsConvertingAll(true);
      try {
        const response = await fetch(`/api/v1/clients/${client.clientId}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ convert: true, update: !!client.autoUpdate, convertWrapping }),
        });
        if (!response.ok) throw new Error('Failed to convert all unmanaged servers');
        await loadData();
        
        // Trigger compliance refresh since conversion affects compliance
        triggerRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to convert all unmanaged servers');
      } finally {
        setIsConvertingAll(false);
      }
    }
  };

  const handleConvertDialogCancel = () => setShowConvertDialog(null);

  const handleUndoAdd = async (serverId: number, serverName: string) => {
    const confirmed = await confirm(
      `Are you sure you want to undo adding server "${serverName}"? This will remove the relationship.`,
      'Undo Add'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/v1/clients/${client.clientId}/servers/${serverId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to undo add server');
      }

      await loadData();
      
      // Trigger compliance refresh since relationship changes affect compliance
      triggerRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to undo add server');
    }
  };

  const handleUndoDelete = async (serverId: number, serverName: string) => {
    const confirmed = await confirm(
      `Are you sure you want to undo deleting server "${serverName}"? This will restore the relationship.`,
      'Undo Delete'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/v1/clients/${client.clientId}/servers/${serverId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to undo delete server');
      }

      await loadData();
      
      // Trigger compliance refresh since relationship changes affect compliance
      triggerRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to undo delete server');
    }
  };

  const handleDeleteServer = async (serverId: number, serverName: string) => {
    const removalNote = client.autoUpdate
      ? ''
      : ' This will mark it for removal.';
    const confirmed = await confirm(
      `Are you sure you want to remove server "${serverName}" from this client?${removalNote}`,
      'Remove Server'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/v1/clients/${client.clientId}/servers/${serverId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete server from client');
      }

      await loadData();
      
      // Trigger compliance refresh since relationship changes affect compliance
      triggerRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete server');
    }
  };

  const getSecurityType = (server: ClientServerRelationshipWithServer) => {
    return server.server?.security || null;
  };

  const getSyncStatus = (relationship: ClientServerRelationshipWithServer) => {
    // If serverId is null, it's a pending deletion (server was deleted)
    if (relationship.serverId === null) {
      return { status: 'Pending Delete', icon: '-' };
    }
    
    if (relationship.syncState === 'add') {
      return { status: 'Pending Add', icon: '+' };
    } else if (relationship.syncState === 'deleteScanned' || relationship.syncState === 'deletePushed') {
      return { status: 'Pending Removal', icon: '-' };
    } else {
      return { status: 'Up to Date', icon: '✓' };
    }
  };



  const handleScan = async () => {
    // Check if client has a configPath
    if (!client?.configPath) {
      await alert(
        'This client does not have a configuration file path set. Scanning requires a valid configPath to read the client configuration.',
        'No Configuration Path'
      );
      return;
    }

    // Check for pending changes
    const pendingChanges = relationships.filter(relationship => 
      relationship.syncState === 'add' || 
      relationship.syncState === 'deleteScanned' || 
      relationship.syncState === 'deletePushed'
    );

    if (pendingChanges.length > 0) {
      const pendingCount = pendingChanges.length;
      const confirmed = await confirm(
        `This client has ${pendingCount} pending change${pendingCount > 1 ? 's' : ''} (add/delete) that may be lost during scanning. You can cancel to push your pending changes first, or continue with scanning.`,
        'Pending Changes Detected'
      );

      if (!confirmed) {
        return;
      }
    }

    try {
      setIsScanning(true);
      setError(null);

      const response = await fetch(`/api/v1/clients/${client.clientId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scan: true,
          import: true,
          convert: false,
          update: false
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to scan client');
      }

      const data = await response.json();
      const syncData = new JsonResponseFetch<SyncResponse>(data, 'sync');
      
      if (!syncData.isSuccess()) {
        throw new Error(syncData.message || 'Scan failed');
      }

      const scanResults = syncData.payload.scanResults;
      if (scanResults && scanResults.servers.length > 0) {
        log.debug(`Client scan completed: Found ${scanResults.servers.length} servers:`, 
          scanResults.servers.map((s: { serverName: string; isManaged: boolean }) => 
            `${s.serverName} (${s.isManaged ? 'managed' : 'unmanaged'})`
          )
        );
      } else {
        log.debug('Client scan completed: No servers found in client configuration');
      }

      // Reload data to show any changes
      await loadData();
      
      // Trigger compliance refresh since scan operations affect compliance
      triggerRefresh();
      
      // Notify parent component that client data has been updated
      onClientUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan client');
    } finally {
      setIsScanning(false);
    }
  };

  // Helper: get all unmanaged relationships
  const unmanagedRelationships = relationships.filter(r => 
    getSecurityType(r) === 'unmanaged' && 
    r.syncState !== 'deleteScanned' && 
    r.syncState !== 'deletePushed'
  );

  const handleConvertAll = () => {
    setShowConvertDialog({ type: 'bulk', count: unmanagedRelationships.length });
  };

  if (loading) {
    return <div className="text-gray-500">Loading servers...</div>;
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
      {/* Warning for unlinked clients */}
      {!client.configPath && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                This client is unlinked
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>If you want to be able to synchronize its configuration, set its config path.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header with Add button */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Servers</h2>
        <div className="flex space-x-3">
          {client.configPath && (
            <>
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isScanning ? 'Scanning...' : 'Scan'}
              </button>
              {relationships.some(relationship => 
                relationship.syncState === 'add' || 
                relationship.syncState === 'deleteScanned' || 
                relationship.syncState === 'deletePushed' ||
                relationship.serverId === null
              ) && (
                <button
                  onClick={handlePushAll}
                  className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                >
                  Push All
                </button>
              )}
              {unmanagedRelationships.length > 0 && (
                <button
                  onClick={handleConvertAll}
                  disabled={isConvertingAll}
                  className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isConvertingAll ? 'Converting...' : `Convert All (${unmanagedRelationships.length})`}
                </button>
              )}
            </>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add Server
          </button>
        </div>
      </div>

      {/* Servers List */}
      {relationships.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No servers configured for this client
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Server Name
                </th>
                {client.configPath && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SYNC
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  NAME ON CLIENT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  MANAGED
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Security
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
                  onClick={() => router.push(`/servers/${relationship.serverId}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img 
                        src={relationship.serverId === null 
                          ? '/assets/generic_256.png' 
                          : getServerIconUrl(relationship.server)
                        } 
                        alt="MCP" 
                        className="w-6 h-6 mr-3"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {relationship.serverId === null 
                            ? 'Deleted Server' 
                            : (relationship.server?.name || 'Unknown Server')
                          }
                        </div>
                        {relationship.server?.description && (
                          <div className="text-sm text-gray-500">
                            {relationship.server.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  {client.configPath && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium mr-2 ${
                          getSyncStatus(relationship).status === 'Pending Add' 
                            ? 'bg-blue-100 text-blue-800' 
                            : getSyncStatus(relationship).status === 'Pending Delete'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {getSyncStatus(relationship).icon}
                        </span>
                        <span className="text-sm text-gray-900">
                          {getSyncStatus(relationship).status}
                        </span>
                      </div>
                    </td>
                  )}
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
                    <ManagedBadge isManaged={getSecurityType(relationship) !== 'unmanaged'} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <SecurityBadge securityType={getSecurityType(relationship) as any} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <SecurityStatusBadge 
                      isUnmanaged={getSecurityType(relationship) === 'unmanaged'}
                      enabled={relationship.server?.enabled}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      {!client.configPath ? (
                        // For unlinked clients, only show Undo Add action
                        getSyncStatus(relationship).status === 'Pending Add' && relationship.serverId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUndoAdd(relationship.serverId!, relationship.server?.name || 'Unknown');
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
                              {relationship.serverId && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteServer(relationship.serverId!, relationship.server?.name || 'Unknown');
                                    }}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    Remove
                                  </button>
                                  {getSecurityType(relationship) === 'unmanaged' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleImportServer(relationship.serverId!, relationship.server?.name || 'Unknown');
                                      }}
                                      className="text-blue-600 hover:text-blue-900"
                                    >
                                      Convert
                                    </button>
                                  )}
                                </>
                              )}
                            </>
                          ) : getSyncStatus(relationship).status === 'Pending Delete' ? (
                            <>
                              {relationship.serverId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUndoDelete(relationship.serverId!, relationship.server?.name || 'Unknown');
                                  }}
                                  className="text-gray-600 hover:text-gray-900"
                                >
                                  Undo
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePushRelationship(relationship);
                                }}
                                className="text-green-600 hover:text-green-900"
                              >
                                Push
                              </button>
                            </>
                          ) : getSyncStatus(relationship).status === 'Pending Add' ? (
                            <>
                              {relationship.serverId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUndoAdd(relationship.serverId!, relationship.server?.name || 'Unknown');
                                  }}
                                  className="text-gray-600 hover:text-gray-900"
                                >
                                  Undo
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePushRelationship(relationship);
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

      {/* Add Server Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Servers to Client</h3>
            
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const availableServersFiltered = availableServers.filter(
                  server => !relationships.some(r => r.serverId === server.serverId)
                );
                
                if (availableServersFiltered.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      <p>No servers available to add.</p>
                      <p className="text-sm mt-2">There are no enabled managed servers not already associated with this client.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 mb-3">
                      Select one or more managed servers to add to this client:
                    </p>
                    {availableServersFiltered.map(server => (
                      <div
                        key={server.serverId}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          selectedServerIds.includes(server.serverId)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => {
                          setSelectedServerIds(prev => 
                            prev.includes(server.serverId)
                              ? prev.filter(id => id !== server.serverId)
                              : [...prev, server.serverId]
                          );
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={selectedServerIds.includes(server.serverId)}
                              onChange={() => {}} // Handled by parent div onClick
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div className="flex items-center">
                                                          <img 
                              src={getServerIconUrl(server)} 
                              alt="MCP" 
                              className="w-10 h-10 mr-2"
                              />
                              <div>
                                <div className="font-medium text-gray-900">
                                  {server.name}
                                  {server.status?.serverInfo && (
                                    <span className="text-gray-500 font-normal">
                                      {' '}({server.status.serverInfo.name} v{server.status.serverInfo.version})
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {server.description || getServerDisplayInfo(server)}
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
                {selectedServerIds.length > 0 
                  ? `${selectedServerIds.length} server${selectedServerIds.length === 1 ? '' : 's'} selected`
                  : 'No servers selected'
                }
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedServerIds([]);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddServer}
                  disabled={selectedServerIds.length === 0}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Add Server{selectedServerIds.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Convert Server Dialog (shared for single and bulk) */}
      <ConvertServerDialog
        isOpen={!!showConvertDialog}
        onConfirm={handleConvertDialogConfirm}
        onCancel={handleConvertDialogCancel}
        serverName={showConvertDialog && showConvertDialog.type === 'single' ? showConvertDialog.serverName : undefined}
        count={showConvertDialog && showConvertDialog.type === 'bulk' ? showConvertDialog.count : undefined}
      />
    </div>
  );
}