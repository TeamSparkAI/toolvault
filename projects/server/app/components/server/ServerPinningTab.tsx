'use client';

import { useState, useEffect } from 'react';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { PackageInfo } from '@/lib/services/packageInfoService';
import { SecurityValidationResult } from '@/lib/services/securityValidationService';
import { PackageExtractionService } from '@/lib/services/packageExtractionService';
import { log } from '@/lib/logging/console';
import { getServerIconUrl } from '@/lib/utils/githubImageUrl';



import { McpServerConfig } from '@/lib/types/server';
import { VersionUpdateService } from '@/lib/services/versionUpdateService';

interface ServerPinningTabProps {
  serverId: number;
  serverName: string;
  serverConfig: McpServerConfig;
  onServerUpdate?: (updatedServer: any) => void; // New callback
}

export function ServerPinningTab({ serverId, serverName, serverConfig, onServerUpdate }: ServerPinningTabProps) {
  const [packageData, setPackageData] = useState<PackageInfo | null>(null);
  const [securityValidation, setSecurityValidation] = useState<SecurityValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [pinningLoading, setPinningLoading] = useState(false);
  const [unpinningLoading, setUnpinningLoading] = useState(false);
  // NEW: Store raw responses from validation for reuse during pinning
  const [cachedRawResponses, setCachedRawResponses] = useState<{
    initialize: object | null;
    toolsList: object | null;
  } | null>(null);
  
  // Initialize selected version from server config
  const analysis = PackageExtractionService.analyzeServerConfig(serverConfig);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(
    analysis.packageInfo?.currentVersion || null
  );

  // Load package info once on component mount
  useEffect(() => {
    loadPackageData();
  }, [serverId]);

  // Load security validation when version changes
  useEffect(() => {
    if (packageData) {
      loadSecurityValidation();
    }
  }, [serverId, selectedVersion, packageData]);

  const loadPackageData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/v1/servers/${serverId}/package`);
      if (!response.ok) {
        throw new Error('Failed to load package information');
      }
      
      const data = await response.json();
      const packageResponse = new JsonResponseFetch<PackageInfo>(data, 'package');
      
      if (!packageResponse.isSuccess()) {
        throw new Error(packageResponse.message || 'Failed to load package information');
      }
      
      setPackageData(packageResponse.payload);
      
      // Only set selected version to latest if server is not pinned AND we don't have a selected version
      if (!packageResponse.payload.currentVersion && !selectedVersion) {
        setSelectedVersion(packageResponse.payload.latestVersion);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load package information');
      log.error('Error loading package data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSecurityValidation = async () => {
    try {
      setValidationLoading(true);
      setSecurityValidation(null);
      
      const url = selectedVersion 
        ? `/api/v1/servers/${serverId}/validate?version=${selectedVersion}`
        : `/api/v1/servers/${serverId}/validate`;
      
      const response = await fetch(url);
      if (!response.ok) {
        // Don't fail the entire component if validation fails
        log.warn('Security validation failed, continuing without it');
        return;
      }
      
      const data = await response.json();
      const validationResponse = new JsonResponseFetch<SecurityValidationResult>(data, 'validation');
      
      if (validationResponse.isSuccess()) {
        setSecurityValidation(validationResponse.payload);
        // Store raw responses for reuse during pinning
        if (validationResponse.payload.rawResponses) {
          setCachedRawResponses(validationResponse.payload.rawResponses);
          log.info('Cached raw responses from validation:', validationResponse.payload.rawResponses);
        }
      } else {
        log.warn('Security validation failed:', validationResponse.message);
      }
    } catch (err) {
      log.error('Error loading security validation:', err);
      // Don't fail the entire component if validation fails
    } finally {
      setValidationLoading(false);
    }
  };

  const handleVersionSelect = (version: string) => {
    setSelectedVersion(version);
  };

  const handlePinToVersion = async () => {
    if (!selectedVersion) {
      setError('No version selected for pinning');
      return;
    }

    try {
      setPinningLoading(true);
      setError(null);

      // Use cached raw responses from previous validation
      if (!cachedRawResponses?.initialize || !cachedRawResponses?.toolsList) {
        throw new Error('No cached raw responses available. Please select a version first to validate it.');
      }
      
      log.info('Using cached raw responses for pinning:', cachedRawResponses);
      
      const pinningInfo = {
        package: {
          registry: packageData?.registry || 'npm',
          name: packageData?.name || '',
          version: selectedVersion
        },
        mcpResponses: {
          initialize: cachedRawResponses.initialize,
          toolsList: cachedRawResponses.toolsList
        },
        pinnedAt: new Date().toISOString(),
        pinnedBy: 'user' // TODO: Get actual user info
      };
      
      log.info('Pinning info prepared with raw responses:', pinningInfo);

      // Create updated config with selected version
      const updatedConfig = await VersionUpdateService.createUpdatedConfig(
        serverConfig, 
        selectedVersion
      );
      
      // Update server via API with pinning info
      const response = await fetch(`/api/v1/servers/${serverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: serverName,
          config: updatedConfig,
          pinningInfo: pinningInfo
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update server configuration');
      }

      const responseData = await response.json();
      
      // Notify parent of update
      onServerUpdate?.(responseData.server);
      
      // Reload package data to reflect new pinned version
      await loadPackageData();
      
      log.info(`Successfully pinned ${packageData?.name} to version ${selectedVersion} with pinning data`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pin version';
      setError(errorMessage);
      log.error('Error pinning version:', err);
    } finally {
      setPinningLoading(false);
    }
  };

  const handleUnpin = async () => {
    try {
      setUnpinningLoading(true);
      setError(null);

      // Create unpinned config (removes version specification)
      const updatedConfig = await VersionUpdateService.createUpdatedConfig(serverConfig, null);
      
      // Update server via API with null pinningInfo to clear it
      const response = await fetch(`/api/v1/servers/${serverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: serverName,
          config: updatedConfig,
          pinningInfo: null // Clear pinning info
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update server configuration');
      }

      const responseData = await response.json();
      
      // Notify parent of update
      onServerUpdate?.(responseData.server);
      
      // Update selected version to reflect unpinned state (use latest)
      if (packageData) {
        setSelectedVersion(packageData.latestVersion);
      }
      
      // Reload package data to reflect unpinned state
      await loadPackageData();
      
      log.info(`Successfully unpinned ${packageData?.name} and cleared pinning data`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unpin version';
      setError(errorMessage);
      log.error('Error unpinning version:', err);
    } finally {
      setUnpinningLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Loading pinning information...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading pinning information</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!packageData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center text-gray-600">No package data available</div>
      </div>
    );
  }



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600">
            <span className="font-bold">Package:</span> <a 
              href={packageData.registry === 'npm' 
                ? `https://www.npmjs.com/package/${packageData.name}` 
                : `https://pypi.org/project/${packageData.name}/`
              } 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              {packageData.name} ({packageData.registry.toUpperCase()})
            </a>
          </p>
          <p className="text-gray-600 mt-1 flex items-center gap-2">
            <span className="font-bold">Version:</span> 
            <span>{(() => {
              const analysis = PackageExtractionService.analyzeServerConfig(serverConfig);
              const pinnedVersion = analysis.packageInfo?.currentVersion;
              if (pinnedVersion) {
                const hasUpdate = packageData && pinnedVersion !== packageData.latestVersion;
                return `Pinned to ${pinnedVersion}${hasUpdate ? ' (update available)' : ' (latest)'}`;
              } else {
                return `Not pinned - currently ${packageData?.latestVersion || 'unknown'} (latest)`;
              }
            })()}</span>
            {(() => {
              const analysis = PackageExtractionService.analyzeServerConfig(serverConfig);
              const pinnedVersion = analysis.packageInfo?.currentVersion;
              if (pinnedVersion) {
                return (
                  <button 
                    onClick={handleUnpin}
                    disabled={unpinningLoading}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      unpinningLoading 
                        ? 'bg-gray-400 text-white cursor-not-allowed' 
                        : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                  >
                    {unpinningLoading ? 'Unpinning...' : 'Unpin'}
                  </button>
                );
              }
              return null;
            })()}
          </p>
        </div>
      </div>

      {/* Package Information */}
      <div className="bg-white rounded-lg border p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Package Details</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Description</dt>
            <dd className="mt-1 text-sm text-gray-900">{packageData.description || 'No description available'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Latest Version</dt>
            <dd className="mt-1 text-sm text-gray-900">{packageData.latestVersion}</dd>
          </div>
          {packageData.author && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Author</dt>
              <dd className="mt-1 text-sm text-gray-900">{packageData.author}</dd>
            </div>
          )}
          {packageData.license && (
            <div>
              <dt className="text-sm font-medium text-gray-500">License</dt>
              <dd className="mt-1 text-sm text-gray-900">{packageData.license}</dd>
            </div>
          )}
          {packageData.homepage && (
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Homepage</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <a href={packageData.homepage} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                  {packageData.homepage}
                </a>
              </dd>
            </div>
          )}
          {packageData.repository && (
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Repository</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <a href={packageData.repository} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                  {packageData.repository}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Available Versions */}
      <div className="bg-white rounded-lg border p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Versions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {packageData.versions
            .sort((a, b) => {
              // Sort versions semantically (latest first)
              const aParts = a.split('.').map(Number);
              const bParts = b.split('.').map(Number);
              for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                const aPart = aParts[i] || 0;
                const bPart = bParts[i] || 0;
                if (aPart !== bPart) return bPart - aPart;
              }
              return 0;
            })
            .map((version) => (
              <button
                key={version}
                onClick={() => handleVersionSelect(version)}
                className={`px-3 py-2 text-sm rounded border transition-colors ${
                  selectedVersion === version
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {version}
                {version === packageData.latestVersion && (
                  <span className="ml-1 text-xs text-green-600">(latest)</span>
                )}
              </button>
            ))}
        </div>
      </div>

      {/* Security Validation Results */}
      <div className="bg-white rounded-lg border p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <img src="/mcp_black.png" alt="MCP" className="w-5 h-5" />
          Validated Server Response
        </h2>
        {validationLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
              <span className="text-sm text-gray-600">Running security validation...</span>
            </div>
          </div>
        ) : securityValidation ? (
          <>
            {securityValidation.errorLog ? (
              <div className="mb-4">
                <dt className="text-sm font-medium text-red-600 mb-2">Error running {packageData.name}{selectedVersion ? (packageData.registry === 'npm' ? `@${selectedVersion}` : `==${selectedVersion}`) : ' latest'}</dt>
                <dd className="mt-1">
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                      {securityValidation.errorLog.map((error, index) => (
                        <li key={index} className="font-mono text-xs">{error}</li>
                      ))}
                    </ul>
                  </div>
                </dd>
              </div>
            ) : (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Package Version</dt>
                  <dd className="mt-1 text-sm text-gray-900 flex items-center gap-2">
                    {selectedVersion || 'Latest'}
                    {(() => {
                      const analysis = PackageExtractionService.analyzeServerConfig(serverConfig);
                      const pinnedVersion = analysis.packageInfo?.currentVersion;
                      const isCurrentVersion = pinnedVersion && selectedVersion === pinnedVersion;
                      
                      if (isCurrentVersion) {
                        return <span className="text-xs text-green-600 font-medium">(current pinned version)</span>;
                      } else {
                        return (
                          <button 
                            onClick={handlePinToVersion}
                            disabled={pinningLoading}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              pinningLoading 
                                ? 'bg-gray-400 text-white cursor-not-allowed' 
                                : 'bg-blue-500 text-white hover:bg-blue-600'
                            }`}
                          >
                            {pinningLoading ? 'Pinning...' : 'Pin to this Version'}
                          </button>
                        );
                      }
                    })()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Validated At</dt>
                  <dd className="mt-1 text-sm text-gray-900">{new Date(securityValidation.validationTime).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Server Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{securityValidation.serverInfo?.name || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Server Version</dt>
                  <dd className="mt-1 text-sm text-gray-900">{securityValidation.serverInfo?.version || 'N/A'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Available Tools</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {securityValidation.tools.length > 0 ? (
                      <ul className="list-disc list-inside space-y-1">
                        {securityValidation.tools.map((tool, index) => (
                          <li key={index}>
                            <span className="font-medium">{tool.name}</span>
                            {tool.description && <span className="text-gray-600"> - {tool.description}</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      'No tools available'
                    )}
                  </dd>
                </div>

              </dl>
            )}
          </>
        ) : (
          <div className="text-center text-gray-500 py-4">
            No validation data available for this version
          </div>
        )}
      </div>
    </div>
  );
}
