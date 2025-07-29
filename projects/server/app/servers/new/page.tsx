'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ServerEditForm } from '@/app/components/server/ServerEditForm';
import { useLayout } from '@/app/contexts/LayoutContext';
import { useCompliance } from '@/app/contexts/ComplianceContext';
import { McpServerConfig } from '@/lib/types/server';
import { Server } from '@/lib/types/server';
import { ServerSecurity } from '@/lib/types/server';
import { log } from '@/lib/logging/console';

const getInitialServer = (): Omit<Server, 'serverId' | 'token'> => {
  // Return empty server by default - we'll handle localStorage in useEffect
  return {
    name: '',
    description: '',
    config: {
      type: 'stdio' as const,
      command: '',
      args: [],
      env: {}
    },
    enabled: true,
    security: undefined,
    status: {
      serverInfo: null,
      lastSeen: null
    }
  };
};

export default function NewServerPage() {
  const router = useRouter();
  const { setHeaderTitle } = useLayout();
  const { triggerRefresh } = useCompliance();
  const [error, setError] = useState<string | null>(null);
  const [initialServer, setInitialServer] = useState<Omit<Server, 'serverId' | 'token'>>(getInitialServer());

  // Set the header title
  useEffect(() => {
    setHeaderTitle('New Server');
    return () => setHeaderTitle(undefined);
  }, [setHeaderTitle]);

  // Handle pre-populated data from catalog selection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const prePopulatedData = localStorage.getItem('prePopulatedServer');
      if (prePopulatedData) {
        try {
          const parsed = JSON.parse(prePopulatedData);
          localStorage.removeItem('prePopulatedServer'); // Clean up
          setInitialServer(parsed);
        } catch (error) {
          log.error('Failed to parse pre-populated server data:', error);
          localStorage.removeItem('prePopulatedServer'); // Clean up
        }
      }
    }
  }, []);

  const handleSaveServer = async (serverData: { serverId?: string; name: string; description?: string; config: McpServerConfig; security?: ServerSecurity; serverCatalogId?: string }) => {
    try {
      const response = await fetch('/api/v1/servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(serverData),
      });

      if (!response.ok) {
        throw new Error('Failed to create server');
      }

      const json = await response.json();
      if (!json.serverId) {
        throw new Error('Invalid response: missing serverId');
      }
      
      // Trigger compliance refresh since new server affects compliance
      triggerRefresh();
      
      // Navigate to the new server
      router.push(`/servers/${json.serverId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleCancel = () => {
    router.push('/servers');
  };

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <ServerEditForm 
        server={initialServer}
        onEdit={handleSaveServer}
        onCancel={handleCancel}
        isNewServer={true}
      />
    </div>
  );
} 