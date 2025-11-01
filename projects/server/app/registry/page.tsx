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
    // Navigate to the server details page
    // Replace / with -- to avoid routing conflicts, use -- as separator too
    const nameEncoded = server.name.replace(/\//g, '--');
    const identifier = `${nameEncoded}--${server.version}`;
    router.push(`/registry/${identifier}`);
  };

  return (
    <div className="space-y-6">
      <ServerRegistrySelector
        onSelectRegistryServer={handleSelectRegistryServer}
      />
    </div>
  );
}
