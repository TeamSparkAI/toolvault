'use client';

import { useState, useEffect } from 'react';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { PackageInfo } from '@/lib/services/packageInfoService';
import { SecurityValidationResult } from '@/lib/services/securityValidationService';
import { PackageExtractionService } from '@/lib/services/packageExtractionService';
import { log } from '@/lib/logging/console';



import { McpServerConfig } from '@/lib/types/server';

interface ServerPinningTabProps {
  serverId: number;
  serverName: string;
  serverConfig: McpServerConfig;
}

export function ServerPinningTab({ serverId, serverName, serverConfig }: ServerPinningTabProps) {
  const [packageData, setPackageData] = useState<PackageInfo | null>(null);
  const [securityValidation, setSecurityValidation] = useState<SecurityValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  
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
      
      // If server is not pinned, set selected version to latest
      if (!analysis.packageInfo?.currentVersion) {
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
          <p className="text-gray-600 mt-1">
            <span className="font-bold">Version:</span> {(() => {
              const analysis = PackageExtractionService.analyzeServerConfig(serverConfig);
              const pinnedVersion = analysis.packageInfo?.currentVersion;
              if (pinnedVersion) {
                const hasUpdate = packageData && pinnedVersion !== packageData.latestVersion;
                return `Pinned to ${pinnedVersion}${hasUpdate ? ' (update available)' : ' (latest)'}`;
              } else {
                return `Not pinned - currently ${packageData?.latestVersion || 'unknown'} (latest)`;
              }
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Security Validation</h2>
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
                  <dd className="mt-1 text-sm text-gray-900">{selectedVersion || 'Latest'}</dd>
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
