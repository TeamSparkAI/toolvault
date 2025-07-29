'use client';

import { useState, useEffect } from 'react';
import { useLayout } from '@/app/contexts/LayoutContext';
import { useModal } from '@/app/contexts/ModalContext';
import { useCompliance } from '@/app/contexts/ComplianceContext';
import { ClientDetails } from '@/app/components/client/ClientDetails';
import { ClientServersTab } from '@/app/components/client/ClientServersTab';
import { Client } from '@/lib/models/types/client';
import { TabType } from '@/app/components/client/ClientTabs';
import { ClientDetailsTab } from '../../components/client/ClientDetailsTab';
import { ClientHeader } from '../../components/client/ClientHeader';
import { ClientTabs } from '../../components/client/ClientTabs';
import { MessagesSection } from '../../components/messages/MessagesSection';
import { AlertsSection } from '../../components/alerts/AlertsSection';

import { Dialog } from '../../components/Dialog';
import { getClientDeleteInfo, buildClientDeleteMessage } from '@/lib/utils/deleteConfirmation';


export default function ClientDetailPage({ params }: { params: { clientId: string } }) {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [isEditing, setIsEditing] = useState(false);
  const { setModalContent } = useModal();
  const { setHeaderTitle } = useLayout();
  const { triggerRefresh } = useCompliance();

  useEffect(() => {
    loadClient();
  }, [params.clientId]);

  useEffect(() => {
    if (client) {
      setHeaderTitle(client.name);
    }
    return () => setHeaderTitle(undefined);
  }, [client, setHeaderTitle]);

  const loadClient = async () => {
    try {
      const response = await fetch(`/api/v1/clients/${params.clientId}`);
      if (!response.ok) {
        throw new Error('Failed to load client');
      }
      const data = await response.json();
      if (!data.client) {
        throw new Error('Invalid client data received');
      }
      setClient(data.client);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load client');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = async (clientData: Omit<Client, 'clientId' | 'lastUpdated' | 'token'>) => {
    try {
      const response = await fetch(`/api/v1/clients/${params.clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientData),
      });

      if (!response.ok) {
        throw new Error('Failed to update client');
      }

      await loadClient();
      setIsEditing(false);
      
      // Trigger compliance refresh since client changes affect compliance
      triggerRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update client');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!client) return;
    
    try {
      // Gather comprehensive delete information
      const deleteInfo = await getClientDeleteInfo(parseInt(params.clientId));
      const deleteMessage = buildClientDeleteMessage(client.name, deleteInfo);
      
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
                await fetch(`/api/v1/clients/${params.clientId}`, { method: 'DELETE' });
                
                // Trigger compliance refresh since client deletion affects compliance
                triggerRefresh();
                
                window.location.href = '/clients';
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to delete client');
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
    if (!client) return;
    
    try {
      const response = await fetch(`/api/v1/clients/${params.clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...client,
          enabled: !client.enabled,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update client');
      }

      await loadClient();
      
      // Trigger compliance refresh since client enabled/disabled affects compliance
      triggerRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update client');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading client...</div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Error: {error || 'Client not found'}</div>
      </div>
    );
  }

  // When editing, show the full ClientDetails component without tabs
  if (isEditing) {
    return (
      <div className="space-y-6">
        <ClientDetails
          clientName={client.name}
          client={client}
          onEdit={handleSaveEdit}
          onDelete={handleDelete}
          onToggleEnabled={handleToggleEnabled}
          onCancel={handleCancelEdit}
        />
      </div>
    );
  }

  // When not editing, show header, tabs, and content
  const isTtvClient = client.type === 'ttv';
  return (
    <div className="space-y-6">
      <ClientHeader
        clientName={client.name}
        client={client}
        onEdit={isTtvClient ? undefined : handleEdit}
        onDelete={isTtvClient ? undefined : handleDelete}
        onToggleEnabled={isTtvClient ? undefined : handleToggleEnabled}
      />

      <ClientTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hideServersTab={isTtvClient}
        clientId={Number(params.clientId)}
      />

      {activeTab === 'details' && (
        <ClientDetailsTab
          client={client}
        />
      )}
      {activeTab === 'messages' && (
        <MessagesSection
          initialFilters={{
            clientId: Number(params.clientId)
          }}
        />
      )}
      {activeTab === 'alerts' && (
        <AlertsSection
          initialFilters={{
            clientId: Number(params.clientId)
          }}
        />
      )}
      {!isTtvClient && activeTab === 'servers' && (
        <ClientServersTab client={client} onClientUpdated={loadClient} />
      )}
    </div>
  );
} 