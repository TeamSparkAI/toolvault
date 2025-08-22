'use client';

import { useState, useEffect, useCallback } from 'react';

import { ServerHeader } from '@/app/components/server/ServerHeader';
import { ServerEditForm } from '@/app/components/server/ServerEditForm';
import { ServerDetailsTab } from '@/app/components/server/ServerDetailsTab';
import { ServerTabs, TabType } from '@/app/components/server/ServerTabs';
import { MessagesSection } from '@/app/components/messages/MessagesSection';
import { AlertsSection } from '@/app/components/alerts/AlertsSection';
import { ToolsSection } from '@/app/components/tools/ToolsSection';
import { McpClientHelper, IMcpClientHelper } from '@/lib/services/mcpClientHelper';
import { Dialog } from '@/app/components/Dialog';
import { useModal } from '@/app/contexts/ModalContext';
import { useLayout } from '@/app/contexts/LayoutContext';
import { useCompliance } from '@/app/contexts/ComplianceContext';
import { HostData } from '@/lib/models/types/host';
import { McpServerConfig } from '@/lib/types/server';
import { Server } from '@/lib/types/server';
import { ServerSecurity } from '@/lib/types/server';
import { ServerClientsTab } from '@/app/components/server/ServerClientsTab';
import { ServerLogsTab } from '@/app/components/server/ServerLogsTab';
import { ServerPinningTab } from '@/app/components/server/ServerPinningTab';
import { getServerDeleteInfo, buildServerDeleteMessage } from '@/lib/utils/deleteConfirmation';
import { log } from '@/lib/logging/console';
import { PackageExtractionService } from '@/lib/services/packageExtractionService';

export default function ServerDetailPage({ params }: { params: { serverId: string } }) {
  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [hostConfig, setHostConfig] = useState<HostData | null>(null);
  const [clientHelper, setClientHelper] = useState<IMcpClientHelper | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { setModalContent } = useModal();
  const { setHeaderTitle } = useLayout();
  const { triggerRefresh } = useCompliance();

  // Cleanup function that's stable
  const cleanupHelper = useCallback(async () => {
    setClientHelper(currentHelper => {
      if (currentHelper) {
        currentHelper.disconnect().catch(err => {
          log.error('Error disconnecting client helper:', err);
        });
      }
      return null;
    });
  }, []);

  useEffect(() => {
    loadServer();
    loadHostConfig();
  }, [params.serverId]);



  useEffect(() => {
    if (server) {
      setHeaderTitle(server.name);
    }
    return () => setHeaderTitle(undefined);
  }, [server, setHeaderTitle]);

  // Create client helper when server or host config changes
  useEffect(() => {
    let currentHelper: IMcpClientHelper | null = null;
    
    const setupHelper = async () => {
      if (server && hostConfig) {
        try {
          // Clean up existing helper first
          await cleanupHelper();
          
          // Create new helper (this doesn't connect yet - it's lazy)
          currentHelper = await McpClientHelper.createForServer(server, hostConfig);
          setClientHelper(currentHelper);
        } catch (err) {
          log.error('Failed to create client helper:', err);
        }
      }
    };

    setupHelper();

    // Cleanup on unmount or when dependencies change
    return () => {
      if (currentHelper) {
        currentHelper.disconnect().catch(err => {
          log.error('Error disconnecting client helper during cleanup:', err);
        });
      }
    };
  }, [server, hostConfig]);

  // Cleanup on page unload
  useEffect(() => {
    return () => {
      cleanupHelper();
    };
  }, []);

  const loadServer = async () => {
    try {
      const response = await fetch(`/api/v1/servers/${params.serverId}`);
      if (!response.ok) {
        throw new Error('Failed to load server');
      }
      const data = await response.json();
      if (!data.server) {
        throw new Error('Invalid server data received');
      }
      setServer(data.server);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load server');
    } finally {
      setLoading(false);
    }
  };

  const handlePing = async () => {
    if (!clientHelper) {
      setModalContent(
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <Dialog
            isOpen={true}
            title="Error"
            message="Client helper not initialized"
            onConfirm={() => setModalContent(null)}
          />
        </div>
      );
      return;
    }

    setIsPinging(true);
    setError(null);
    try {
      const result = await clientHelper.ping();
      setModalContent(
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <Dialog
            isOpen={true}
            title="Ping Successful"
            message={`Response time: ${result.elapsedTimeMs.toFixed(3)}ms`}
            onConfirm={() => setModalContent(null)}
          />
        </div>
      );
    } catch (err) {
      setModalContent(
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <Dialog
            isOpen={true}
            title="Ping Failed"
            message={err instanceof Error ? err.message : 'Failed to ping server'}
            onConfirm={() => setModalContent(null)}
          />
        </div>
      );
    } finally {
      setIsPinging(false);
      setError(null);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = async (server: { id?: string; name: string; description?: string; config: McpServerConfig; security?: ServerSecurity; serverCatalogId?: string }) => {
    try {
      const response = await fetch(`/api/v1/servers/${params.serverId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(server),
      });

      if (!response.ok) {
        throw new Error('Failed to update server');
      }

      const responseData = await response.json();
      
      // Disconnect client helper when server config changes
      await cleanupHelper();
      
      await loadServer();
      setIsEditing(false);
      
      // Trigger compliance refresh since server changes affect compliance
      triggerRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update server');
    }
  };

  const handleServerUpdate = async (updatedServer: any) => {
    try {
      // Disconnect client helper when server config changes
      await cleanupHelper();
      
      await loadServer();
      
      // Trigger compliance refresh since server changes affect compliance
      triggerRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update server');
    }
  };

  const handleDelete = async () => {
    if (!server) return;
    
    try {
      // Gather comprehensive delete information
      const deleteInfo = await getServerDeleteInfo(parseInt(params.serverId));
      const deleteMessage = buildServerDeleteMessage(server.name, deleteInfo);
      
      setModalContent(
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <Dialog
            isOpen={true}
            title={deleteMessage.title}
            message={deleteMessage.message}
            type="confirm"
            confirmText={deleteMessage.recommendDisable ? "Delete Anyway" : "Delete"}
            onConfirm={async () => {
              try {
                await fetch(`/api/v1/servers/${params.serverId}`, { method: 'DELETE' });
                
                // Trigger compliance refresh since server deletion affects compliance
                triggerRefresh();
                
                window.location.href = '/servers';
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to delete server');
              }
            }}
            onCancel={() => setModalContent(null)}
          />
        </div>
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to gather delete information');
    }
  };

  const handleToggleEnabled = async () => {
    if (!server) return;
    
    try {
      const response = await fetch(`/api/v1/servers/${params.serverId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...server,
          enabled: !server.enabled,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update server');
      }

      await loadServer();
      
      // Trigger compliance refresh since server enable/disable affects compliance
      triggerRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update server');
    }
  };

  const loadHostConfig = async () => {
    try {
      const response = await fetch('/api/v1/host');
      if (!response.ok) {
        throw new Error('Failed to load host config');
      }
      const data = await response.json();
      setHostConfig(data);
    } catch (err) {
      log.error('Error loading host config:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading server...</div>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Error: {error || 'Server not found'}</div>
      </div>
    );
  }

  // When editing, show the full ServerEditForm component without tabs
  if (isEditing) {
    return (
      <div className="space-y-6">
        <ServerEditForm
          server={server}
          onEdit={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      </div>
    );
  }

  // When not editing, show header, tabs, and content
  const isUnmanaged = server.security === 'unmanaged';
  
  // Determine if server is pinnable
  const analysis = PackageExtractionService.analyzeServerConfig(server.config);
  const isPinnable = analysis.packageInfo !== null;
  
  // If the active tab is 'clients' but the server is unmanaged, default to 'details'
  // If the active tab is 'pinning' but the server is not pinnable, default to 'details'
  const effectiveActiveTab = (isUnmanaged && activeTab === 'clients') || (!isPinnable && activeTab === 'pinning') ? 'details' : activeTab;
  
  return (
    <div className="space-y-6">
      <ServerHeader
        serverName={server.name}
        server={server}
        onEdit={isUnmanaged ? undefined : handleEdit}
        onDelete={handleDelete}
        onToggleEnabled={isUnmanaged ? undefined : handleToggleEnabled}
        onPing={handlePing}
      />

      <ServerTabs
        activeTab={effectiveActiveTab}
        onTabChange={setActiveTab}
        isUnmanaged={isUnmanaged}
        serverId={Number(params.serverId)}
        serverType={server.config.type}
        isPinnable={isPinnable}
      />

      {effectiveActiveTab === 'messages' && !isUnmanaged && (
        <MessagesSection
          initialFilters={{ serverId: parseInt(params.serverId) }}
        />
      )}

      {effectiveActiveTab === 'alerts' && !isUnmanaged && (
        <AlertsSection
          initialFilters={{
            serverId: Number(params.serverId)
          }}
        />
      )}

      {effectiveActiveTab === 'tools' && (
        <ToolsSection
          serverId={params.serverId}
          serverName={server?.name || ''}
          clientHelper={clientHelper}
        />
      )}

      {effectiveActiveTab === 'details' && (
        <ServerDetailsTab
          serverName={server.name}
          config={server.config}
          server={server}
          onEdit={isUnmanaged ? undefined : handleEdit}
          onDelete={handleDelete}
        />
      )}

      {effectiveActiveTab === 'clients' && !isUnmanaged && (
        <ServerClientsTab serverId={Number(params.serverId)} server={server} />
      )}

      {effectiveActiveTab === 'logs' && (
        <ServerLogsTab serverToken={server.token} />
      )}

      {effectiveActiveTab === 'pinning' && isPinnable && (
        <ServerPinningTab 
          serverId={Number(params.serverId)} 
          serverName={server.name} 
          serverConfig={server.config}
          onServerUpdate={handleServerUpdate}
        />
      )}
    </div>
  );
} 