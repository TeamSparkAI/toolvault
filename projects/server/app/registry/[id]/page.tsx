'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ServerJSON, Argument } from '@/types/mcp-registry';
import { Server } from '@/lib/types/server';
import { McpServerConfig } from '@/lib/types/server';
import { useLayout } from '@/app/contexts/LayoutContext';
import { useModal } from '@/app/contexts/ModalContext';
import { JsonResponseFetch } from '@/lib/jsonResponse';

export default function RegistryDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { setHeaderTitle } = useLayout();
  const { setModalContent } = useModal();
  const [server, setServer] = useState<ServerJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const versionId = params.id as string;

  useEffect(() => {
    loadServerDetails();
  }, [versionId]);

  const loadServerDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all servers and find the one matching our ID
      const response = await fetch('/api/v1/server-registry');
      if (!response.ok) {
        throw new Error('Failed to load server registry');
      }
      
      const data = await response.json();
      
      if (!data.servers) {
        throw new Error('Invalid response format');
      }
      
      // Find server by versionId
      const targetServer = data.servers.find((s: ServerJSON) => 
        s._meta?.['io.modelcontextprotocol.registry/official']?.versionId === versionId
      );
      
      if (!targetServer) {
        throw new Error('Server not found');
      }
      
      setServer(targetServer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load server details');
    } finally {
      setLoading(false);
    }
  };

  const createServerConfigFromPackage = (pkg: any): McpServerConfig => {
    if (pkg.transport) {
      if (pkg.transport.type === 'stdio') {
        // For stdio, use runtimeHint as command or infer from registry type
        let command = pkg.runtimeHint;
        let inferredArgs: string[] = [];
        
        if (!command) {
          // Infer command and first argument from registry type
          switch (pkg.registryType) {
            case 'npm':
              command = 'npx';
              inferredArgs = [pkg.identifier];
              break;
            case 'pypi':
              command = 'uvx';
              inferredArgs = [pkg.identifier];
              break;
            default:
              command = pkg.identifier; // Fallback to identifier as command
          }
        } else {
          // If we have a runtimeHint, check if we need to add package reference
          if ((command === 'npx' || command === 'uvx') && (!pkg.runtimeArguments || pkg.runtimeArguments.length === 0)) {
            inferredArgs = [pkg.identifier];
          }
        }
        
        // Combine runtimeArguments and packageArguments
        // For each argument, if it has both name and value, include both as separate args
        const runtimeArgs: string[] = [];
        if (pkg.runtimeArguments) {
          pkg.runtimeArguments.forEach((arg: Argument) => {
            if (arg.type === 'named' && arg.name) {
              runtimeArgs.push(arg.name);
            }
            if (arg.value) {
              runtimeArgs.push(arg.value);
            }
          });
        }
        
        const packageArgs: string[] = [];
        if (pkg.packageArguments) {
          pkg.packageArguments.forEach((arg: Argument) => {
            if (arg.type === 'named' && arg.name) {
              packageArgs.push(arg.name);
            }
            if (arg.value) {
              packageArgs.push(arg.value);
            }
          });
        }
        
        const allArgs = [...inferredArgs, ...runtimeArgs, ...packageArgs];
        
        // Convert environment variables to env object
        const env: Record<string, string> = {};
        if (pkg.environmentVariables && pkg.environmentVariables.length > 0) {
          pkg.environmentVariables.forEach((envVar: any) => {
            if (envVar.name) {
              // Use the value if provided, otherwise use default, otherwise leave empty
              env[envVar.name] = envVar.value || envVar.default || '';
            }
          });
        }
        
        return {
          type: 'stdio',
          command: command,
          args: allArgs,
          env: Object.keys(env).length > 0 ? env : undefined
        };
      } else if (pkg.transport.type === 'sse' || pkg.transport.type === 'streamable') {
        const headers: Record<string, string> = {};
        if (pkg.transport.headers && pkg.transport.headers.length > 0) {
          pkg.transport.headers.forEach((header: any) => {
            if (header.name) {
              // Use the value if provided, otherwise leave empty for user to fill
              headers[header.name] = header.value || '';
            }
          });
        }
        
        return {
          type: pkg.transport.type as 'sse' | 'streamable',
          url: pkg.transport.url || '',
          headers: Object.keys(headers).length > 0 ? headers : undefined
        };
      }
    }
    return { type: 'stdio', command: '', args: [] };
  };

  const createServerConfigFromRemote = (remote: any): McpServerConfig => {
    // For remotes, we only consider headers
    const headers: Record<string, string> = {};
    if (remote.headers && remote.headers.length > 0) {
      remote.headers.forEach((header: any) => {
        if (header.name) {
          // Use the value if provided, otherwise leave empty for user to fill
          headers[header.name] = header.value || '';
        }
      });
    }
    
    if (remote.type === 'sse') {
      return {
        type: 'sse',
        url: remote.url || '',
        headers: Object.keys(headers).length > 0 ? headers : undefined
      };
    } else if (remote.type === 'streamable-http') {
      return {
        type: 'streamable',
        url: remote.url || '',
        headers: Object.keys(headers).length > 0 ? headers : undefined
      };
    }
    
    // Fallback for unknown remote types
    return { type: 'sse', url: remote.url || '', headers: Object.keys(headers).length > 0 ? headers : undefined };
  };

  const handleAddServerFromPackage = (pkg: any, pkgIndex: number) => {
    if (!server) return;

    const serverConfig = createServerConfigFromPackage(pkg);
    const serverName = `${server.name} (${pkg.registryType})`;
    
    const prePopulatedServer: Omit<Server, 'serverId' | 'token'> = {
      name: serverName,
      description: server.description,
      config: serverConfig,
      enabled: true,
      security: undefined,
      status: {
        serverInfo: null,
        lastSeen: null
      }
    };

    localStorage.setItem('prePopulatedServer', JSON.stringify(prePopulatedServer));
    router.push('/servers/new');
  };

  const handleAddServerFromRemote = (remote: any, remoteIndex: number) => {
    if (!server) return;

    const serverConfig = createServerConfigFromRemote(remote);
    const serverName = `${server.name} (${remote.type})`;
    
    const prePopulatedServer: Omit<Server, 'serverId' | 'token'> = {
      name: serverName,
      description: server.description,
      config: serverConfig,
      enabled: true,
      security: undefined,
      status: {
        serverInfo: null,
        lastSeen: null
      }
    };

    localStorage.setItem('prePopulatedServer', JSON.stringify(prePopulatedServer));
    router.push('/servers/new');
  };

  const handleBack = () => {
    router.push('/registry');
  };

  const handleViewRaw = () => {
    if (!server) return;
    
    const jsonData = JSON.stringify(server, null, 2);
    setModalContent(
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900">View Server as JSON</h3>
          <p className="text-sm text-gray-500 mt-1">Complete server object in JSON format (read-only)</p>
        </div>
        <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto max-h-96">{jsonData}</pre>
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
          Back to Registry
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
          Back to Registry
        </button>
      </div>
    );
  }

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
              <img src="/mcp_black.png" alt="MCP Server" className="w-10 h-10" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-gray-900">{server.name}</h1>
              </div>
              <p className="text-gray-600 mt-1">{server.description}</p>
              {server.websiteUrl && (
                <div className="mt-2">
                  <a 
                    href={server.websiteUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 break-all"
                  >
                    {server.websiteUrl}
                  </a>
                </div>
              )}
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                <span>Version: {server.version}</span>
                {server.status && <span>Status: {server.status}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="space-y-6">
        {/* Repository Information */}
        {server.repository && server.repository.url && server.repository.url.trim() !== '' && (
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
              {server.repository.subfolder && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Subfolder</label>
                  <p className="text-gray-900">{server.repository.subfolder}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Remotes Section */}
        {server.remotes && server.remotes.length > 0 && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Remotes</h2>
            <div className="space-y-4">
              {server.remotes.map((remote, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Type</label>
                          <p className="text-gray-900 font-mono">{remote.type}</p>
                        </div>
                        {(remote.type === 'streamable-http' || remote.type === 'sse') && remote.url && (
                          <div>
                            <label className="text-sm font-medium text-gray-500">URL</label>
                            <a 
                              href={remote.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 break-all block"
                            >
                              {remote.url}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddServerFromRemote(remote, index)}
                      className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap flex-shrink-0"
                    >
                      Add Server
                    </button>
                  </div>
                  {(remote.type === 'streamable-http' || remote.type === 'sse') && remote.headers && remote.headers.length > 0 && (
                    <div className="mt-4">
                      <label className="text-sm font-medium text-gray-500">Headers</label>
                      <div className="mt-1 space-y-2">
                        {remote.headers.map((header, headerIndex) => (
                          <div key={headerIndex} className="flex items-center space-x-4 text-sm">
                            <span className="font-mono bg-gray-100 px-2 py-1 rounded">{header.name}</span>
                            <span className="text-gray-600">:</span>
                            <span className="font-mono bg-gray-100 px-2 py-1 rounded">{header.value || '(empty)'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Packages Section */}
        {server.packages && server.packages.length > 0 && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Packages</h2>
            <div className="space-y-4">
              {server.packages.map((pkg, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Identifier</label>
                      <div>
                        {pkg.registryType === 'npm' ? (
                          <a 
                            href={`https://www.npmjs.com/package/${pkg.identifier}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 font-mono break-all"
                          >
                            {pkg.identifier}
                          </a>
                        ) : pkg.registryType === 'pypi' ? (
                          <a 
                            href={`https://pypi.org/project/${pkg.identifier}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 font-mono break-all"
                          >
                            {pkg.identifier}
                          </a>
                        ) : (
                          <p className="text-gray-900 font-mono">{pkg.identifier}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Version</label>
                      <p className="text-gray-900">v{pkg.version}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Registry Type</label>
                      <p className="text-gray-900">{pkg.registryType}</p>
                    </div>
                  </div>
                    </div>
                    <button
                      onClick={() => handleAddServerFromPackage(pkg, index)}
                      className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap flex-shrink-0"
                    >
                      Add Server
                    </button>
                  </div>


                  {pkg.runtimeHint && (
                    <div className="border-t border-gray-100 pt-4 mt-4">
                      <label className="text-sm font-medium text-gray-500">Runtime Hint</label>
                      <p className="text-gray-900 font-mono text-sm bg-gray-50 p-2 rounded">{pkg.runtimeHint}</p>
                    </div>
                  )}

                  {pkg.runtimeArguments && pkg.runtimeArguments.length > 0 && (
                    <div className="border-t border-gray-100 pt-4 mt-4">
                      <label className="text-sm font-medium text-gray-500">Runtime Arguments</label>
                      <div className="mt-1 space-y-2">
                        {pkg.runtimeArguments.map((arg, argIndex) => (
                          <div key={argIndex} className="flex items-center space-x-4 text-sm">
                            {arg.type === 'named' && arg.name && (
                              <span className="font-mono bg-gray-100 px-2 py-1 rounded">{arg.name}</span>
                            )}
                            {arg.type === 'named' && arg.name && (
                              <span className="text-gray-600">:</span>
                            )}
                            <span className="font-mono bg-gray-100 px-2 py-1 rounded">{arg.value || arg.default || '(empty)'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pkg.packageArguments && pkg.packageArguments.length > 0 && (
                    <div className="border-t border-gray-100 pt-4 mt-4">
                      <label className="text-sm font-medium text-gray-500">Package Arguments</label>
                      <div className="mt-1 space-y-2">
                        {pkg.packageArguments.map((arg, argIndex) => (
                          <div key={argIndex} className="flex items-center space-x-4 text-sm">
                            {arg.type === 'named' && arg.name && (
                              <span className="font-mono bg-gray-100 px-2 py-1 rounded">{arg.name}</span>
                            )}
                            {arg.type === 'named' && arg.name && (
                              <span className="text-gray-600">:</span>
                            )}
                            <span className="font-mono bg-gray-100 px-2 py-1 rounded">{arg.value || arg.default || '(empty)'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pkg.environmentVariables && pkg.environmentVariables.length > 0 && (
                    <div className="border-t border-gray-100 pt-4 mt-4">
                      <label className="text-sm font-medium text-gray-500">Environment Variables</label>
                      <div className="mt-1 space-y-2">
                        {pkg.environmentVariables.map((envVar, envIndex) => (
                          <div key={envIndex} className="flex items-center space-x-4 text-sm">
                            <span className="font-mono bg-gray-100 px-2 py-1 rounded">{envVar.name}</span>
                            <span className="text-gray-600">:</span>
                            <span className="font-mono bg-gray-100 px-2 py-1 rounded">{envVar.value || envVar.default || '(empty)'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}


        {/* Registry Metadata */}
        {server._meta && (
          <div className="bg-white rounded-lg border p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Registry Information</h2>
              <button
                onClick={handleViewRaw}
                className="text-sm text-blue-500 hover:text-blue-700"
              >
                View Raw
              </button>
            </div>
            <div className="space-y-3">
              {server._meta['io.modelcontextprotocol.registry/official'] && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Server ID</label>
                    <p className="text-gray-900 font-mono text-sm">{server._meta['io.modelcontextprotocol.registry/official'].serverId}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Version ID</label>
                    <p className="text-gray-900 font-mono text-sm">{server._meta['io.modelcontextprotocol.registry/official'].versionId}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Published</label>
                    <p className="text-gray-900">
                      {new Date(server._meta['io.modelcontextprotocol.registry/official'].publishedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Latest Version</label>
                    <p className="text-gray-900">
                      {server._meta['io.modelcontextprotocol.registry/official'].isLatest ? 'Yes' : 'No'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
