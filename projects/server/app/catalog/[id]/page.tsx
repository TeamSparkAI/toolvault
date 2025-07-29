'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ServerCatalogEntry } from '@/types/server-catalog';
import { Server } from '@/lib/types/server';
import { McpServerConfig } from '@/lib/types/server';
import { useLayout } from '@/app/contexts/LayoutContext';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { getServerCatalogIconUrl } from '@/lib/utils/githubImageUrl';

export default function CatalogDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { setHeaderTitle } = useLayout();
  const [server, setServer] = useState<ServerCatalogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const serverId = params.id as string;

  // No need to set header title - breadcrumb logic handles it

  useEffect(() => {
    loadServerDetails();
  }, [serverId]);

  const loadServerDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/v1/server-catalog/${serverId}`);
      if (!response.ok) {
        throw new Error('Failed to load server details');
      }
      
      const data = await response.json();
      const serverResponse = new JsonResponseFetch<ServerCatalogEntry>(data, 'server');
      
      if (!serverResponse.isSuccess()) {
        throw new Error(serverResponse.message || 'Failed to load server details');
      }
      
      setServer(serverResponse.payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load server details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddServer = () => {
    if (!server) return;

    // Convert catalog entry to server config
    let serverConfig: McpServerConfig | undefined = server.serverConfig;
    if (!serverConfig) {
      // Use a default config if not present
      serverConfig = { type: 'stdio', command: '', args: [] };
    }
    
    // Create a pre-populated server object
    const prePopulatedServer: Omit<Server, 'serverId' | 'token'> = {
      name: server.name,
      description: server.description,
      config: serverConfig,
      enabled: true,
      security: undefined,
      serverCatalogId: server.id, // Link to the catalog entry
      status: {
        serverInfo: null,
        lastSeen: null
      }
    };

    // Navigate to new server page with pre-populated data
    localStorage.setItem('prePopulatedServer', JSON.stringify(prePopulatedServer));
    router.push('/servers/new');
  };

  const handleBack = () => {
    router.push('/catalog');
  };

  const getServerConfigSummary = (server: ServerCatalogEntry): string => {
    if (!server.serverConfig) {
      return 'N/A';
    }
    
    const config = server.serverConfig;
    const type = config.type || 'stdio';
    
    if (type === 'sse' || type === 'streamable') {
      const url = (config as any).url || '';
      if (url) {
        try {
          const urlObj = new URL(url);
          return `${type} - ${urlObj.host}`;
        } catch (e) {
          return `${type} - ${url}`;
        }
      }
      return `${type} - No URL`;
    } else {
      // For stdio servers, show command
      const command = (config as any).command || '';
      return `${type} - ${command || 'No command'}`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading server details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Error: {error}</div>
        <button
          onClick={handleBack}
          className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Back to Catalog
        </button>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="text-yellow-800">Server not found</div>
        <button
          onClick={handleBack}
          className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Back to Catalog
        </button>
      </div>
    );
  }

  const isVerified = server.tags.includes('official') || 
    (server.tags.includes('reference') && !server.tags.includes('archived'));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4 min-w-0 flex-1 mr-6">
            <button
              onClick={handleBack}
              className="p-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <img src={getServerCatalogIconUrl(server)} alt={server.name} className="w-10 h-10" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-gray-900">{server.name}</h1>
                {isVerified && (
                  <span className="inline-flex items-center justify-center bg-blue-500 rounded-full p-1 flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </div>
              <p className="text-gray-600 mt-1">{server.description}</p>
            </div>
          </div>
          <button
            onClick={handleAddServer}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap flex-shrink-0"
          >
            Add Server
          </button>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Server Configuration */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Server Configuration</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Transport Type</label>
              <p className="text-gray-900">{getServerConfigSummary(server)}</p>
            </div>
            {server.serverConfig && (
              <div>
                <label className="text-sm font-medium text-gray-500">Configuration</label>
                <pre className="mt-1 p-3 bg-gray-50 rounded text-sm overflow-x-auto">
                  {JSON.stringify(server.serverConfig, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Repository Information */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Repository</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Source</label>
              <p className="text-gray-900 capitalize">{server.repository.source}</p>
            </div>
            <div>
              <a 
                href={server.repository.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 break-all"
              >
                {server.repository.url}
              </a>
            </div>
            {server.repository.stars && (
              <div>
                <label className="text-sm font-medium text-gray-500">Stars</label>
                <p className="text-gray-900">⭐ {server.repository.stars.toLocaleString()}</p>
              </div>
            )}
            {server.repository.lastUpdated && (
              <div>
                <label className="text-sm font-medium text-gray-500">Last Updated</label>
                <p className="text-gray-900">
                  {new Date(server.repository.lastUpdated).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {server.tags.map((tag) => (
              <span
                key={tag}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  tag === 'official' || tag === 'reference'
                    ? 'bg-blue-100 text-blue-800'
                    : tag === 'archived'
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
          <p className="text-gray-700 leading-relaxed">{server.description}</p>
        </div>
      </div>
    </div>
  );
} 