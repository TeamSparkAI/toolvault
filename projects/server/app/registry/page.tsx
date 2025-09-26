'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ServerRegistrySelector } from '@/app/components/server/ServerRegistrySelector';
import { ServerJSON } from '@/types/mcp-registry';
import { useLayout } from '@/app/contexts/LayoutContext';

export default function RegistryPage() {
  const router = useRouter();
  const { setHeaderTitle } = useLayout();

  // Set the header title for breadcrumb navigation
  useEffect(() => {
    setHeaderTitle('Server Registry');
    return () => setHeaderTitle(undefined);
  }, [setHeaderTitle]);

  const handleSelectRegistryServer = (server: ServerJSON) => {
    // Navigate to the server details page using versionId for uniqueness
    const versionId = server._meta?.['io.modelcontextprotocol.registry/official']?.versionId;
    if (!versionId) {
      console.error('No versionId found for server:', server.name);
      return;
    }
    router.push(`/registry/${versionId}`);
  };

  return (
    <div className="space-y-6">
      <ServerRegistrySelector
        onSelectRegistryServer={handleSelectRegistryServer}
      />
    </div>
  );
}
