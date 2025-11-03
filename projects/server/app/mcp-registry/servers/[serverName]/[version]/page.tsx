'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ServerWithMeta, 
  ServerDetail,
  ServerDetailView,
  generateConfiguredServer,
  createTrimmedServer,
  useRegistryClient
} from '@teamsparkai/mcp-registry-ux';
import { mcpRegistryNavigationAdapter } from '@/lib/adapters/mcpRegistryNavigationAdapter';
import { decodeServerNameFromRoute } from '@/lib/utils/registryRouteUtils';
import { useLayout } from '@/app/contexts/LayoutContext';
import { useModal } from '@/app/contexts/ModalContext';

export default function McpRegistryServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { setHeaderTitle } = useLayout();
  const { setModalContent } = useModal();
  const { client } = useRegistryClient();
  const [server, setServer] = useState<ServerWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configuringServer, setConfiguringServer] = useState<ServerDetail | null>(null);
  const [packageConfig, setPackageConfig] = useState<Record<string, any>>({});
  const [remoteConfig, setRemoteConfig] = useState<Record<string, any>>({});
  const [showRawModal, setShowRawModal] = useState(false);
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadServer();
  }, [params.serverName, params.version, client]);

  const loadServer = async () => {
    try {
      setLoading(true);
      const serverName = decodeServerNameFromRoute(params.serverName as string);
      const version = params.version as string;
      
      const serverResponse = await client.getServerVersion(serverName, version);
      
      // Convert ServerResponse to ServerWithMeta
      const unwrappedServer: ServerWithMeta = {
        ...serverResponse.server,
        _meta: serverResponse._meta
      };
      
      setServer(unwrappedServer);
      setHeaderTitle(serverResponse.server.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load server');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigurePackage = (pkg: any, index: number) => {
    if (!server) return;
    const trimmed = createTrimmedServer(server, index, undefined);
    setConfiguringServer(trimmed);
    setPackageConfig({});
  };

  const handleConfigureRemote = (remote: any, index: number) => {
    if (!server) return;
    const trimmed = createTrimmedServer(server, undefined, index);
    setConfiguringServer(trimmed);
    setRemoteConfig({});
  };

  const handleConfigurationOk = (trimmedServer: ServerDetail, config: any) => {
    // TODO: Integration with ToolVault catalog
    // This is where we'll add the configured server to the local catalog
    console.log('Configuration ready to install:', { trimmedServer, config });
    
    // For now, show a modal with the configuration
    setModalContent(
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Server Configuration Ready</h2>
        <p className="text-gray-600">
          This server is now configured and ready to be added to your catalog.
        </p>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Server:</h3>
          <p className="text-sm">{trimmedServer.name} v{trimmedServer.version}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">MCP Config:</h3>
          <pre className="text-xs overflow-x-auto">
            {JSON.stringify(config.mcpServerConfig, null, 2)}
          </pre>
        </div>
        {/* TODO: Add "Install to Catalog" button that calls catalog API */}
      </div>
    );
  };

  const closeConfiguration = () => {
    setConfiguringServer(null);
    setPackageConfig({});
    setRemoteConfig({});
    setVisibleFields(new Set());
  };

  const toggleFieldVisibility = (fieldId: string) => {
    setVisibleFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldId)) {
        newSet.delete(fieldId);
      } else {
        newSet.add(fieldId);
      }
      return newSet;
    });
  };

  const handleBackToRegistry = () => {
    router.push('/mcp-registry');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading server details...</p>
        </div>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Server Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'The requested server could not be found.'}</p>
          <button
            onClick={handleBackToRegistry}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Registry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ServerDetailView
      server={server}
      configuringServer={configuringServer}
      packageConfig={packageConfig}
      remoteConfig={remoteConfig}
      visibleFields={visibleFields}
      showRawModal={showRawModal}
      configuredServer={generateConfiguredServer(configuringServer, packageConfig, remoteConfig)}
      onPackageConfigChange={setPackageConfig}
      onRemoteConfigChange={setRemoteConfig}
      onToggleFieldVisibility={toggleFieldVisibility}
      onCloseConfiguration={closeConfiguration}
      onShowRawModal={setShowRawModal}
      onConfigurePackage={handleConfigurePackage}
      onConfigureRemote={handleConfigureRemote}
      onConfigurationOk={handleConfigurationOk}
      okButtonLabel="Install to Catalog"
      navigationAdapter={mcpRegistryNavigationAdapter}
    />
  );
}

