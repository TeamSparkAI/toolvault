'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClientDetails } from '@/app/components/client/ClientDetails';
import { useLayout } from '@/app/contexts/LayoutContext';
import { useCompliance } from '@/app/contexts/ComplianceContext';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { Client } from '@/lib/models/types/client';

const emptyClient: Omit<Client, 'clientId'> = {
  type: 'generic',
  scope: 'project',
  name: '',
  description: null,
  configPath: null,
  autoUpdate: false,
  enabled: true
};

export default function NewClientPage() {
  const router = useRouter();
  const { setHeaderTitle } = useLayout();
  const { triggerRefresh } = useCompliance();
  const [error, setError] = useState<string | null>(null);

  // Set the header title
  useEffect(() => {
    setHeaderTitle('New Client');
    return () => setHeaderTitle(undefined);
  }, [setHeaderTitle]);

  const handleSaveClient = async (clientData: Omit<Client, 'clientId' | 'lastUpdated' | 'token'>) => {
    try {
      const response = await fetch('/api/v1/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...clientData, scope: 'project' }),
      });

      if (!response.ok) {
        throw new Error('Failed to create client');
      }

      const json = await response.json();
      const result = new JsonResponseFetch<Client>(json, 'client');
      if (!result.isSuccess()) {
        throw new Error(result.message || 'Failed to create client');
      }

      // Trigger compliance refresh since new client affects compliance
      triggerRefresh();

      // Navigate to the new client
      router.push(`/clients/${result.payload.clientId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleCancel = () => {
    router.push('/clients');
  };

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <ClientDetails 
        client={emptyClient}
        onEdit={handleSaveClient}
        onCancel={handleCancel}
        isNewClient={true}
      />
    </div>
  );
} 