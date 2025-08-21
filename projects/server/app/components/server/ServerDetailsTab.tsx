import React, { useState, useEffect } from 'react';
import { McpServerConfig } from '@/lib/types/server';
import { getSecurityType, isSecurityUnwrappable, unwrapSecurity, wrapSecurity } from '@/lib/utils/security';
import { ServerSecurity } from '@/lib/types/server';
import { useModal } from '@/app/contexts/ModalContext';
import { SecurityBadge } from '@/app/components/common/SecurityBadge';
import { getClientIcon } from '@/lib/client-icons';
import { getServerCatalogIconUrl } from '@/lib/utils/githubImageUrl';
import { ServerCatalogEntry } from '@/types/server-catalog';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { isSecretEnvVar } from '@/app/lib/utils/secret';
import { HideReveal } from '../common/HideReveal';
import { ClientType } from '@/lib/types/clientType';
import { log } from '@/lib/logging/console';

interface ServerDetailsTabProps {
  serverName: string;
  config: McpServerConfig;
  server: {
    description?: string;
    enabled: boolean;
    security?: ServerSecurity;
    serverCatalogId?: string;
    serverCatalogIcon?: string;
    status: {
      serverInfo?: {
        name: string;
        version: string;
      } | null;
      lastSeen: string | null;
    };
    clientOwner?: {
      clientId: number;
      name: string;
      description?: string;
      type: ClientType;
    } | null;
    lastSynced?: string | null;
    token?: string;
  };
  onEdit?: () => void;
  onDelete: () => void;
}

export function ServerDetailsTab({ serverName, config, server, onEdit, onDelete }: ServerDetailsTabProps) {
  const { setModalContent } = useModal();
  const [catalogEntry, setCatalogEntry] = useState<ServerCatalogEntry | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [showWrappedView, setShowWrappedView] = useState(false);
  const [showToken, setShowToken] = useState(false);
  // Obfuscate token as XXXX-XXXX-XXXX
  const obfuscatedToken = server.token?.replace(/[A-Z0-9]/g, 'X') || '';

  // Load catalog entry if server is linked
  useEffect(() => {
    const loadCatalogEntry = async () => {
      if (server.serverCatalogId) {
        setIsLoadingCatalog(true);
        try {
          const response = await fetch(`/api/v1/server-catalog/${server.serverCatalogId}`);
          if (!response.ok) {
            throw new Error('Failed to load catalog entry');
          }
          const data = await response.json();
          const catalogResponse = new JsonResponseFetch<ServerCatalogEntry>(data, 'server');
          if (catalogResponse.isSuccess()) {
            setCatalogEntry(catalogResponse.payload);
          } else {
            throw new Error(catalogResponse.message || 'Failed to load catalog entry');
          }
        } catch (error) {
          log.error('Failed to load catalog entry:', error);
        } finally {
          setIsLoadingCatalog(false);
        }
      } else {
        setCatalogEntry(null);
      }
    };

    loadCatalogEntry();
  }, [server.serverCatalogId]);

  const securityType = getSecurityType(config, server.security);
  
  // Determine which config to display based on wrapped state and toggle
  const displayConfig = (() => {
    if (server.security === 'wrapped' && isSecurityUnwrappable(config)) {
      return showWrappedView ? config : unwrapSecurity(config);
    }
    return config;
  })();

  const handleViewAsJson = () => {
    const jsonConfig = JSON.stringify(config, null, 2);
    setModalContent(
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900">View Configuration as JSON</h3>
          <p className="text-sm text-gray-500 mt-1">Server configuration in JSON format (read-only)</p>
        </div>
        <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto max-h-96">{jsonConfig}</pre>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setModalContent(null)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  return (
    <dl className="divide-y divide-gray-200">
      {/* Catalog Entry Information */}
      {server.serverCatalogId && (
        <div className="bg-blue-50 px-4 py-5 sm:px-6">
          {isLoadingCatalog ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
              <span className="text-sm text-gray-900">Loading catalog entry...</span>
            </div>
          ) : catalogEntry ? (
            <a
              href={`/catalog/${catalogEntry.id}`}
              className="flex items-center gap-3 text-blue-600 hover:text-blue-800 hover:underline"
            >
              <span className="text-sm text-gray-900">Created from Catalog Entry:</span>
              <img
                src={getServerCatalogIconUrl(catalogEntry)}
                alt={`${catalogEntry.name} icon`}
                className="w-5 h-5 -mr-1.5"
              />
              <span className="font-medium">{catalogEntry.name}</span>
            </a>
          ) : (
            <div className="text-sm text-gray-900">
              Created from Catalog Entry: {server.serverCatalogId}
            </div>
          )}
        </div>
      )}

      {/* Server Token */}
      {server.token && (
        <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
          <dt className="text-sm font-medium text-gray-500">Token</dt>
          <dd className="mt-1 text-sm text-gray-900 sm:mt-0 flex items-center gap-4">
            <span className="font-mono select-all">{showToken ? server.token : obfuscatedToken}</span>
            <button
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => setShowToken((v) => !v)}
            >
              {showToken ? 'Hide' : 'Reveal'}
            </button>
          </dd>
        </div>
      )}

      {/* Server Info/Client Owner and Last Seen/Last Synced */}
      {server.security === 'unmanaged' ? (
        <>
          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Client Owner</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              {server.clientOwner ? (
                <div className="flex items-center">
                  <img
                    src={getClientIcon(server.clientOwner.type)}
                    alt={`${server.clientOwner.type} icon`}
                    className="w-5 h-5 mr-2"
                  />
                  <a
                    href={`/clients/${server.clientOwner.clientId}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {server.clientOwner.name}
                  </a>
                  {server.clientOwner.description && (
                    <span className="text-gray-500 ml-2">{server.clientOwner.description}</span>
                  )}
                </div>
              ) : (
                '-'
              )}
            </dd>
          </div>
          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Last Synced</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              {server.lastSynced
                ? new Date(server.lastSynced).toLocaleString()
                : 'Never'}
            </dd>
          </div>
        </>
      ) : (
        <>
          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Server Info</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              {server.status.serverInfo?.name
                ? `${server.status.serverInfo.name} (${server.status.serverInfo.version || '-'})`
                : '-'}
            </dd>
          </div>
          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Last Seen</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              {server.status.lastSeen
                ? new Date(server.status.lastSeen).toLocaleString()
                : 'Never'}
            </dd>
          </div>
        </>
      )}

      {/* Server Configuration */}
      <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
        <dt className="text-sm font-medium text-gray-500">Type</dt>
        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 flex items-center justify-between">
          <span>{config.type}</span>
          <button
            onClick={handleViewAsJson}
            className="ml-4 px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            View as JSON
          </button>
        </dd>
      </div>

      {displayConfig.type === 'stdio' ? (
        <>
          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Command</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 flex items-center justify-between">
              <span className="font-mono">{(displayConfig as any).command || '-'}</span>
              {server.security === 'wrapped' && isSecurityUnwrappable(config) && (
                <button
                  onClick={() => setShowWrappedView(!showWrappedView)}
                  className="ml-4 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {showWrappedView ? 'Show Simple View' : 'Show Container View'}
                </button>
              )}
            </dd>
          </div>

          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Arguments</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              {(displayConfig as any).args && (displayConfig as any).args.length > 0 ? (
                <ul className="list-disc list-inside space-y-1">
                  {(displayConfig as any).args.map((arg: string, index: number) => (
                    <li key={index} className="font-mono">{arg}</li>
                  ))}
                </ul>
              ) : (
                '-'
              )}
            </dd>
          </div>

          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Environment</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              {(displayConfig as any).env && Object.keys((displayConfig as any).env).length > 0 ? (
                <ul className="space-y-1">
                  {Object.entries((displayConfig as any).env as Record<string, string>).map(([key, value], index) => (
                    <li key={index} className="font-mono flex items-center gap-2">
                      <span>{key}</span>
                      <span className="text-gray-500"> = </span>
                      {isSecretEnvVar(key) ? (
                        <HideReveal value={value} />
                      ) : (
                        value && <span className="text-gray-500">{value}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                '-'
              )}
            </dd>
          </div>

          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Directory (cwd)</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              {(displayConfig as any).cwd ? (
                <span className="font-mono">{(displayConfig as any).cwd}</span>
              ) : (
                '-'
              )}
            </dd>
          </div>
        </>
      ) : (
        <>
          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">URL</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              {(config as any).url || '-'}
            </dd>
          </div>

          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Headers</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              {(config as any).headers && Object.keys((config as any).headers).length > 0 ? (
                <ul className="space-y-1">
                  {Object.entries((config as any).headers as Record<string, string>).map(([key, value], index) => (
                    <li key={index}>
                      <span className="font-mono">{key}</span>
                      {value && <span className="text-gray-500"> = {value}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                '-'
              )}
            </dd>
          </div>
        </>
      )}

      {/* Security */}
      <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
        <dt className="text-sm font-medium text-gray-500">Security</dt>
        <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
          <SecurityBadge securityType={securityType} />
        </dd>
      </div>
    </dl>
  );
} 