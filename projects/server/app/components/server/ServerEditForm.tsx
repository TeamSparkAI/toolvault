import React, { useState, useEffect } from 'react';
import { McpServerConfig, ServerSecurity, Server } from '@/lib/types/server';
import { getSecurityType, isSecurityWrappable, isSecurityUnwrappable, wrapSecurity, unwrapSecurity } from '@/lib/utils/security';
import { getServerCatalogIconUrl } from '@/lib/utils/githubImageUrl';
import { ServerCatalogEntry } from '@/types/server-catalog';
import { useNavigationGuard } from '@/app/hooks/useNavigationGuard';
import { useDialog } from '@/app/hooks/useDialog';
import { useModal } from '@/app/contexts/ModalContext';
import { isSecretEnvVar } from '@/app/lib/utils/secret';
import { SecretEditField } from '../common/SecretEditField';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { log } from '@/lib/logging/console';

type NewServer = Omit<Server, 'serverId' | 'token'>;

type ServerEditFormProps =
  | { server: Server; onEdit: (server: { id?: string; name: string; description?: string; config: McpServerConfig; security?: ServerSecurity; serverCatalogId?: string }) => Promise<void>; onCancel?: () => void; isNewServer?: false }
  | { server: NewServer; onEdit: (server: { id?: string; name: string; description?: string; config: McpServerConfig; security?: ServerSecurity; serverCatalogId?: string }) => Promise<void>; onCancel?: () => void; isNewServer: true };

export function ServerEditForm({
  server,
  onEdit,
  onCancel,
  isNewServer = false
}: ServerEditFormProps) {
  const [editedServer, setEditedServer] = useState<Server | NewServer>(server);
  const [error, setError] = useState<string | null>(null);
  const [showValidationAlert, setShowValidationAlert] = useState(false);
  const [jsonConfig, setJsonConfig] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [catalogEntry, setCatalogEntry] = useState<ServerCatalogEntry | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  const { confirm } = useDialog();
  const { setModalContent } = useModal();

  // Update editedServer when server prop changes
  useEffect(() => {
    // On Load: If security is wrapped and config is unwrappable, display unwrapped
    if (server.security === 'wrapped' && isSecurityUnwrappable(server.config)) {
      setEditedServer({
        ...server,
        config: unwrapSecurity(server.config),
        security: 'wrapped' // Keep the security as wrapped for save logic
      });
    } else {
      setEditedServer(server);
    }
  }, [server]);

  // Load catalog entry if server is linked
  useEffect(() => {
    const loadCatalogEntry = async () => {
      if (editedServer.serverCatalogId) {
        setIsLoadingCatalog(true);
        try {
          const response = await fetch(`/api/v1/server-catalog/${editedServer.serverCatalogId}`);
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
  }, [editedServer.serverCatalogId]);

  useNavigationGuard(
    true, // Always in editing mode
    async () => {
      const confirmed = await confirm('You have unsaved changes. Are you sure you want to leave?', 'Unsaved Changes');
      return confirmed;
    }
  );

  // Function to check if server can be wrapped/unwrapped
  const canRunInContainer = (config: McpServerConfig): boolean => {
    return isSecurityWrappable(config) || isSecurityUnwrappable(config);
  };

  const handleSave = async () => {
    // Validate required fields
    if (!editedServer.name.trim()) {
      setShowValidationAlert(true);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      
      let configToSave = editedServer.config;
      let security = editedServer.security;
      
      // On Save: If wrapped, wrap and save
      if (editedServer.security === 'wrapped') {
        configToSave = wrapSecurity(editedServer.config);
        security = 'wrapped';
      } else if (editedServer.security === 'container') {
        // Keep the wrapped config and container security as-is
        configToSave = editedServer.config;
        security = 'container';
      } else {
        // Determine security based on the unwrapped config
        security = getSecurityType(editedServer.config, undefined);
      }

      const serverToSave = {
        name: editedServer.name,
        description: editedServer.description,
        config: configToSave,
        security,
        serverCatalogId: editedServer.serverCatalogId
      };

      await onEdit(serverToSave);
      setShowValidationAlert(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedServer(server);
    onCancel?.();
  };

  const handleRemoveCatalogLink = () => {
    setEditedServer({
      ...editedServer,
      serverCatalogId: '',
      serverCatalogIcon: undefined
    });
  };



  const handleTypeChange = (newType: 'stdio' | 'sse' | 'streamable') => {
    if (newType === 'stdio') {
      setEditedServer({
        ...editedServer,
        config: {
          type: 'stdio',
          command: '',
          args: [],
          env: {}
        }
      });
    } else {
      setEditedServer({
        ...editedServer,
        config: {
          type: newType,
          url: '',
          headers: {}
        }
      });
    }
  };

  const handleEditAsJson = () => {
    const currentJsonConfig = JSON.stringify(editedServer.config, null, 2);
    setJsonConfig(currentJsonConfig);
    
    // Create a local state for the modal to avoid async state update issues
    let modalJsonConfig = currentJsonConfig;
    
    setModalContent(
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900">Edit Configuration as JSON</h3>
          <p className="text-sm text-gray-500 mt-1">Edit the server configuration in JSON format</p>
        </div>
        <textarea
          defaultValue={modalJsonConfig}
          className="w-full h-96 p-3 border border-gray-300 rounded-md font-mono text-sm"
          placeholder="Enter JSON configuration..."
          onChange={(e) => {
            modalJsonConfig = e.target.value;
            setJsonConfig(e.target.value);
          }}
        />
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={() => setModalContent(null)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              try {
                const parsedConfig = JSON.parse(modalJsonConfig);
                
                // Validate that it has the required type field
                if (!parsedConfig.type || !['stdio', 'sse', 'streamable'].includes(parsedConfig.type)) {
                  throw new Error('Invalid configuration: missing or invalid "type" field');
                }

                // Validate stdio configuration
                if (parsedConfig.type === 'stdio') {
                  if (!parsedConfig.command) {
                    throw new Error('Invalid stdio configuration: missing "command" field');
                  }
                  if (!Array.isArray(parsedConfig.args)) {
                    throw new Error('Invalid stdio configuration: "args" must be an array');
                  }
                }

                // Validate HTTP configuration
                if (parsedConfig.type === 'sse' || parsedConfig.type === 'streamable') {
                  if (!parsedConfig.url) {
                    throw new Error(`Invalid ${parsedConfig.type} configuration: missing "url" field`);
                  }
                }

                // Force a complete state update by creating a new object
                const updatedServer = {
                  ...editedServer,
                  config: parsedConfig
                };
                
                log.debug('Updating server config from JSON:', parsedConfig);
                setEditedServer(updatedServer);
                setModalContent(null);
              } catch (err) {
                setModalContent(
                  <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-medium text-red-900">JSON Parse Error</h3>
                      <p className="text-sm text-red-700 mt-1">{err instanceof Error ? err.message : 'Invalid JSON'}</p>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => setModalContent(null)}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                      >
                        OK
                      </button>
                    </div>
                  </div>
                );
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            OK
          </button>
        </div>
      </div>
    );
  };

  const securityType = getSecurityType(editedServer.config, editedServer.security);

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="text-red-800">Error: {error}</div>
        </div>
      )}
      
      {showValidationAlert && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Required Fields Missing</h3>
                <div className="mt-2 text-sm text-gray-500">
                  <p>Please fill in all required fields before saving:</p>
                  <ul className="list-disc pl-5 mt-2">
                    {!editedServer.name.trim() && (
                      <li>Server name is required</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowValidationAlert(false)}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-5 sm:px-6">
        <div className="flex justify-between items-start">
          <div className="flex-grow pr-4">
            <div className="flex-grow">
              <div className="flex items-baseline gap-2">
                <div className="flex-grow">
                  <input
                    type="text"
                    value={editedServer.name}
                    onChange={(e) => setEditedServer({ ...editedServer, name: e.target.value })}
                    className={`text-lg font-medium text-gray-900 border rounded px-2 py-1 w-full ${
                      editedServer.name.trim() === '' ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter server name"
                    required
                  />
                  {editedServer.name.trim() === '' && (
                    <p className="mt-1 text-sm text-red-600">Server name is required</p>
                  )}
                </div>
              </div>
              <textarea
                value={editedServer.description || ''}
                onChange={(e) => setEditedServer({ ...editedServer, description: e.target.value })}
                className="mt-1 text-sm text-gray-500 border rounded px-2 py-1 w-full"
                rows={3}
                placeholder="Optional description of this server"
              />
              {editedServer.serverCatalogId && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isLoadingCatalog ? (
                        <div className="w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                      ) : catalogEntry ? (
                        <>
                          <span className="text-sm text-gray-900">Created from Catalog Entry:</span>
                          <img
                            src={getServerCatalogIconUrl(catalogEntry)}
                            alt={`${catalogEntry.name} icon`}
                            className="w-5 h-5 -mr-1.5"
                          />
                          <span className="font-medium">{catalogEntry.name}</span>
                        </>
                      ) : (
                        <div className="text-sm text-gray-900">
                          Created from Catalog Entry: {editedServer.serverCatalogId}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleRemoveCatalogLink}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 whitespace-nowrap"
                    >
                      Remove Link
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 space-x-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-4 py-2 rounded ${
                isSaving 
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className={`px-4 py-2 rounded ${
                isSaving 
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200">
        <dl>
          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Type</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 flex items-center justify-between">
              <select
                value={editedServer.config.type}
                onChange={(e) => handleTypeChange(e.target.value as 'stdio' | 'sse' | 'streamable')}
                className="px-1.5 py-1 text-sm border rounded w-auto min-w-[100px]"
              >
                <option value="stdio">Stdio</option>
                <option value="sse">SSE</option>
                <option value="streamable">Streamable</option>
              </select>
              <button
                onClick={handleEditAsJson}
                className="ml-4 px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Edit as JSON
              </button>
            </dd>
          </div>

          {editedServer.config.type === 'stdio' ? (
            <>
              <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Command</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
                  <input
                    type="text"
                    value={(editedServer.config as any).command || ''}
                    onChange={(e) => setEditedServer({
                      ...editedServer,
                      config: { ...editedServer.config, command: e.target.value } as McpServerConfig
                    })}
                    className="w-full p-2 border rounded"
                    placeholder="Enter command"
                  />
                </dd>
              </div>

              <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Arguments</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
                  <div>
                    {(editedServer.config as any).args?.map((arg: string, index: number) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={arg}
                          onChange={(e) => {
                            const newArgs = [...(editedServer.config as any).args];
                            newArgs[index] = e.target.value;
                            setEditedServer({
                              ...editedServer,
                              config: { ...editedServer.config, args: newArgs } as McpServerConfig
                            });
                          }}
                          className="flex-1 p-2 border rounded"
                        />
                        <button
                          onClick={() => {
                            const newArgs = [...(editedServer.config as any).args];
                            newArgs.splice(index, 1);
                            setEditedServer({
                              ...editedServer,
                              config: { ...editedServer.config, args: newArgs } as McpServerConfig
                            });
                          }}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const currentArgs = (editedServer.config as any).args || [];
                        setEditedServer({
                          ...editedServer,
                          config: { ...editedServer.config, args: [...currentArgs, ''] } as McpServerConfig
                        });
                      }}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Add Argument
                    </button>
                  </div>
                </dd>
              </div>

              <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Environment</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
                  <div>
                    {Object.entries((editedServer.config as any).env || {}).map(([key, value], index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={key}
                          onChange={(e) => {
                            const newEnv = { ...(editedServer.config as any).env };
                            delete newEnv[key];
                            newEnv[e.target.value] = value as string;
                            setEditedServer({
                              ...editedServer,
                              config: { ...editedServer.config, env: newEnv } as McpServerConfig
                            });
                          }}
                          placeholder="Key"
                          className="w-1/3 p-2 border rounded"
                        />
                        {isSecretEnvVar(key) ? (
                          <SecretEditField
                            value={value as string}
                            onChange={(v) => {
                              const newEnv = { ...(editedServer.config as any).env };
                              newEnv[key] = v;
                              setEditedServer({
                                ...editedServer,
                                config: { ...editedServer.config, env: newEnv } as McpServerConfig
                              });
                            }}
                          />
                        ) : (
                          <input
                            type="text"
                            value={value as string}
                            onChange={(e) => {
                              const newEnv = { ...(editedServer.config as any).env };
                              newEnv[key] = e.target.value;
                              setEditedServer({
                                ...editedServer,
                                config: { ...editedServer.config, env: newEnv } as McpServerConfig
                              });
                            }}
                            placeholder="Value"
                            className="flex-1 p-2 border rounded"
                          />
                        )}
                        <button
                          onClick={() => {
                            const newEnv = { ...(editedServer.config as any).env };
                            delete newEnv[key];
                            setEditedServer({
                              ...editedServer,
                              config: { ...editedServer.config, env: newEnv } as McpServerConfig
                            });
                          }}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const currentEnv = (editedServer.config as any).env || {};
                        setEditedServer({
                          ...editedServer,
                          config: { ...editedServer.config, env: { ...currentEnv, '': '' } } as McpServerConfig
                        });
                      }}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Add Environment Variable
                    </button>
                  </div>
                </dd>
              </div>

              <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Directory (cwd)</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
                  <input
                    type="text"
                    value={(editedServer.config as any).cwd || ''}
                    onChange={(e) => setEditedServer({
                      ...editedServer,
                      config: { ...editedServer.config, cwd: e.target.value } as McpServerConfig
                    })}
                    className="w-full p-2 border rounded"
                    placeholder="Enter working directory (e.g., ~/myapp, $HOME/project)"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Optional. Supports path expansion: ~ for home directory, $VAR for environment variables.
                  </p>
                </dd>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">URL</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
                  <input
                    type="text"
                    value={(editedServer.config as any).url || ''}
                    onChange={(e) => setEditedServer({
                      ...editedServer,
                      config: { ...editedServer.config, url: e.target.value } as McpServerConfig
                    })}
                    className="w-full p-2 border rounded"
                    placeholder="Enter URL"
                  />
                </dd>
              </div>

              <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Headers</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
                  <div>
                    {Object.entries((editedServer.config as any).headers || {}).map(([key, value], index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={key}
                          onChange={(e) => {
                            const newHeaders = { ...(editedServer.config as any).headers };
                            delete newHeaders[key];
                            newHeaders[e.target.value] = value as string;
                            setEditedServer({
                              ...editedServer,
                              config: { ...editedServer.config, headers: newHeaders } as McpServerConfig
                            });
                          }}
                          placeholder="Key"
                          className="w-1/3 p-2 border rounded"
                        />
                        <input
                          type="text"
                          value={value as string}
                          onChange={(e) => {
                            const newHeaders = { ...(editedServer.config as any).headers };
                            newHeaders[key] = e.target.value;
                            setEditedServer({
                              ...editedServer,
                              config: { ...editedServer.config, headers: newHeaders } as McpServerConfig
                            });
                          }}
                          placeholder="Value"
                          className="flex-1 p-2 border rounded"
                        />
                        <button
                          onClick={() => {
                            const newHeaders = { ...(editedServer.config as any).headers };
                            delete newHeaders[key];
                            setEditedServer({
                              ...editedServer,
                              config: { ...editedServer.config, headers: newHeaders } as McpServerConfig
                            });
                          }}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const currentHeaders = (editedServer.config as any).headers || {};
                        setEditedServer({
                          ...editedServer,
                          config: { ...editedServer.config, headers: { ...currentHeaders, '': '' } } as McpServerConfig
                        });
                      }}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Add Header
                    </button>
                  </div>
                </dd>
              </div>
            </>
          )}

          {/* Security */}
          {editedServer.config.type === 'stdio' && (
            (isSecurityWrappable(editedServer.config) || editedServer.security === 'wrapped' || (editedServer.security === 'container' && isSecurityUnwrappable(editedServer.config))) && (
              <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Security</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
                  <div className="space-y-2">
                    {/* Show "Run in Container" checkbox for wrappable configs */}
                    {isSecurityWrappable(editedServer.config) && (
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editedServer.security === 'wrapped'}
                          onChange={(e) => {
                            setEditedServer({
                              ...editedServer,
                              security: e.target.checked ? 'wrapped' : null
                            });
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2">Run in Container</span>
                      </label>
                    )}
                    
                    {/* Show "Convert to Container" button for wrapped configs */}
                    {editedServer.security === 'wrapped' && (
                      <button
                        type="button"
                        onClick={() => {
                          // Convert to container by wrapping the config and setting security to container
                          setEditedServer({
                            ...editedServer,
                            config: wrapSecurity(editedServer.config),
                            security: 'container'
                          });
                        }}
                        className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm"
                      >
                        Convert to Container
                      </button>
                    )}
                    
                    {/* Show "Convert to Run in Container" button for container configs that are unwrappable */}
                    {editedServer.security === 'container' && isSecurityUnwrappable(editedServer.config) && (
                      <button
                        type="button"
                        onClick={() => {
                          // Convert to wrapped by unwrapping the config and setting security to wrapped
                          setEditedServer({
                            ...editedServer,
                            config: unwrapSecurity(editedServer.config),
                            security: 'wrapped'
                          });
                        }}
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                      >
                        Convert to Run in Container
                      </button>
                    )}
                  </div>
                </dd>
              </div>
            )
          )}
        </dl>
      </div>
    </div>
  );
} 