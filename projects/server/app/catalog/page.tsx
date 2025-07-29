'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ServerCatalogSelector } from '@/app/components/server/ServerCatalogSelector';
import { ServerCatalogEntry } from '@/types/server-catalog';
import { useLayout } from '@/app/contexts/LayoutContext';

export default function CatalogPage() {
  const router = useRouter();
  const { setHeaderTitle } = useLayout();

  // Set the header title for breadcrumb navigation
  useEffect(() => {
    setHeaderTitle('Server Catalog');
    return () => setHeaderTitle(undefined);
  }, [setHeaderTitle]);

  const handleSelectCustom = () => {
    // Navigate to the existing new server page with empty form
    router.push('/servers/new');
  };

  const handleSelectCatalogServer = (server: ServerCatalogEntry) => {
    // Navigate to the server details page
    router.push(`/catalog/${server.id}`);
  };

  const handleCancel = () => {
    router.push('/servers');
  };

  return (
    <div className="space-y-6">
      <ServerCatalogSelector
        onSelectCustom={handleSelectCustom}
        onSelectCatalogServer={handleSelectCatalogServer}
        onCancel={handleCancel}
      />
    </div>
  );
} 