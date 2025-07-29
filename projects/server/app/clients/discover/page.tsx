'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLayout } from '@/app/contexts/LayoutContext';
import { useDialog } from '@/app/hooks/useDialog';
import { useCompliance } from '@/app/contexts/ComplianceContext';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import type { DiscoveredClient, ScanOptions } from '@/lib/services/clientDiscoveryService';
import { getClientIcon } from '@/lib/client-icons';
import { clientTypeNames } from '@/lib/types/clientType';
import type { ImportRequest } from '@/app/api/v1/clients/discover/import/route';

interface ImportResponse {
  success: boolean;
  importedCount: number;
  totalRequested: number;
}

export default function ClientDiscoveryPage() {
  const router = useRouter();
  const { setHeaderAction } = useLayout();
  const { alert, confirm } = useDialog();
  const { triggerRefresh } = useCompliance();
  const [discoveredClients, setDiscoveredClients] = useState<DiscoveredClient[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [scanOptions, setScanOptions] = useState<ScanOptions>({
    global: true,
    project: {
      enabled: true,
      mode: 'current'
    }
  });
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discoveryPanelCollapsed, setDiscoveryPanelCollapsed] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importPreferences, setImportPreferences] = useState({
    convertToManaged: true,
    runInContainer: false,
    autoUpdate: true
  });

  useEffect(() => {
    setHeaderAction(
      <div className="flex gap-2">
        <button
          onClick={() => router.push('/clients')}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Back to Clients
        </button>
      </div>
    );

    return () => setHeaderAction(null);
  }, [setHeaderAction, router]);

  const handleScan = async () => {
    try {
      setIsScanning(true);
      setError(null);
      setDiscoveredClients([]);
      setSelectedClients(new Set());
      setDiscoveryPanelCollapsed(false); // Always expand before scan

      const response = await fetch('/api/v1/clients/discover/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scanOptions),
      });

      if (!response.ok) {
        throw new Error('Failed to scan for clients');
      }

      const data = await response.json();
      const scanData = new JsonResponseFetch<DiscoveredClient[]>(data, 'clients');
      
      if (!scanData.isSuccess()) {
        throw new Error(scanData.message || 'Scan failed');
      }
      
      setDiscoveredClients(scanData.payload);
      // Default to all clients selected after scan
      setSelectedClients(new Set(scanData.payload.map(client => client.configPath)));
      if (scanData.payload.length === 0) {
        await alert('No clients found during scan. Try adjusting your scan options.', 'Scan Complete');
      } else {
        setDiscoveryPanelCollapsed(true); // Collapse after successful scan with results
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan for clients');
    } finally {
      setIsScanning(false);
    }
  };

  const handleImport = async () => {
    if (selectedClients.size === 0) {
      await alert('Please select at least one client to import.', 'No Clients Selected');
      return;
    }

    setShowImportDialog(true);
  };

  const handleImportConfirm = async () => {
    try {
      setIsImporting(true);
      setError(null);

      // Send full DiscoveredClient objects for selected clients
      const selectedDiscoveredClients = discoveredClients.filter(client => selectedClients.has(client.configPath));
      const payload: ImportRequest = {
        clients: selectedDiscoveredClients,
        convertToManaged: importPreferences.convertToManaged,
        runInContainer: importPreferences.runInContainer,
        autoUpdate: importPreferences.autoUpdate
      };
      const response = await fetch('/api/v1/clients/discover/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to import clients');
      }

      const data = await response.json();
      const importData = new JsonResponseFetch<ImportResponse>(data, 'import');
      
      if (!importData.isSuccess()) {
        throw new Error(importData.message || 'Import failed');
      }
      
      setShowImportDialog(false);
      await alert(
        `Successfully imported ${importData.payload.importedCount} client${importData.payload.importedCount > 1 ? 's' : ''}.`,
        'Import Complete'
      );
      
      // Trigger compliance refresh since import operations affect compliance
      triggerRefresh();
      
      router.push('/clients');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import clients');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClientSelection = (configPath: string, checked: boolean) => {
    const newSelected = new Set(selectedClients);
    if (checked) {
      newSelected.add(configPath);
    } else {
      newSelected.delete(configPath);
    }
    setSelectedClients(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedClients.size === discoveredClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(discoveredClients.map(client => client.configPath)));
    }
  };

  const allSelected = discoveredClients.length > 0 && selectedClients.size === discoveredClients.length;

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Client Discovery</h2>
          {discoveredClients.length > 0 && (
            <button
              onClick={() => setDiscoveryPanelCollapsed((c) => !c)}
              className="text-sm text-blue-600 hover:text-blue-800"
              aria-expanded={!discoveryPanelCollapsed}
              aria-controls="discovery-panel"
            >
              {discoveryPanelCollapsed ? 'Expand' : 'Collapse'}
            </button>
          )}
        </div>
        <div id="discovery-panel">
          {!discoveryPanelCollapsed && (
            <>
              {/* Scan Options */}
              <div className="space-y-6 mb-6">
                {/* Global Scan */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={scanOptions.global}
                      onChange={(e) => setScanOptions(prev => ({ ...prev, global: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">Global Scan</span>
                  </label>
                  <p className="text-sm text-gray-500 ml-6 mt-1">
                    Scan for system, application, or user level tool configurations
                  </p>
                </div>

                {/* Project Scan */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={scanOptions.project.enabled}
                      onChange={(e) => setScanOptions(prev => ({ 
                        ...prev, 
                        project: { ...prev.project, enabled: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">Project Scan</span>
                  </label>
                  <p className="text-sm text-gray-500 ml-6 mt-1">
                    Scan for projects using or capable of using tools
                  </p>

                  {scanOptions.project.enabled && (
                    <div className="ml-6 mt-3 space-y-3">
                      <div>
                        <div className="space-y-2">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="scanMode"
                              value="current"
                              checked={scanOptions.project.mode === 'current'}
                              onChange={(e) => setScanOptions(prev => ({ 
                                ...prev, 
                                project: { ...prev.project, mode: e.target.value as 'current' | 'capable' }
                              }))}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Projects currently using tools</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="scanMode"
                              value="capable"
                              checked={scanOptions.project.mode === 'capable'}
                              onChange={(e) => setScanOptions(prev => ({ 
                                ...prev, 
                                project: { ...prev.project, mode: e.target.value as 'current' | 'capable' }
                              }))}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Projects capable of using tools</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Directory (Optional)</label>
                        <input
                          type="text"
                          value={scanOptions.project.directory || ''}
                          onChange={(e) => setScanOptions(prev => ({ 
                            ...prev, 
                            project: { ...prev.project, directory: e.target.value || undefined }
                          }))}
                          placeholder="Leave empty to scan home directory"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Scan Button */}
              <div className="flex justify-center">
                <button
                  onClick={handleScan}
                  disabled={isScanning}
                  className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isScanning ? 'Scanning...' : 'Scan for Clients'}
                </button>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-red-800">Error: {error}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Results */}
      {discoveredClients.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Discovered Clients ({discoveredClients.length})
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  disabled={selectedClients.size === 0 || isImporting}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'Importing...' : `Import Selected (${selectedClients.size})`}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAll}
                      className="mr-2"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Config
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {discoveredClients.map((client) => (
                  <tr key={client.configPath}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedClients.has(client.configPath)}
                        onChange={(e) => handleClientSelection(client.configPath, e.target.checked)}
                        className="mr-2"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex flex-col items-start">
                        <span className="inline-flex items-center">
                          <img
                            src={getClientIcon(client.clientType)}
                            alt={clientTypeNames[client.clientType] || client.clientType}
                            className="w-5 h-5 mr-2 inline-block align-middle"
                          />
                          <span>{clientTypeNames[client.clientType] || client.clientType}</span>
                        </span>
                        <span className="text-xs text-gray-500 ml-7">{client.isGlobal ? 'Global' : 'Project'}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium">{client.name}</div>
                      {client.description && (
                        <div className="text-xs text-gray-500">{client.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{client.configPath}</div>
                      <div className="text-xs text-gray-400">
                        {client.isActual && client.hasMcpConfig
                          ? `${client.serverCount} MCP server${client.serverCount !== 1 ? 's' : ''} found`
                          : client.isActual && !client.hasMcpConfig
                          ? 'No MCP configuration found in file'
                          : 'MCP configuration file doesn\'t exist yet'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Import {selectedClients.size} Client{selectedClients.size > 1 ? 's' : ''}
            </h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={importPreferences.autoUpdate}
                    onChange={(e) => setImportPreferences(prev => ({ 
                      ...prev, 
                      autoUpdate: e.target.checked 
                    }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Auto Update
                  </span>
                </label>
                <p className="text-sm text-gray-500 ml-6 mt-1">
                  After import, automatically update client configuration whenever server changes are made
                </p>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={importPreferences.convertToManaged}
                    onChange={(e) => setImportPreferences(prev => ({ 
                      ...prev, 
                      convertToManaged: e.target.checked 
                    }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Convert found servers to managed
                  </span>
                </label>
                <p className="text-sm text-gray-500 ml-6 mt-1">
                  Convert unmanaged servers used by imported clients to managed servers during import
                </p>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={importPreferences.convertToManaged && importPreferences.runInContainer}
                    onChange={(e) => setImportPreferences(prev => ({ 
                      ...prev, 
                      runInContainer: e.target.checked 
                    }))}
                    disabled={!importPreferences.convertToManaged}
                    className="mr-2"
                  />
                  <span className={`text-sm font-medium ${!importPreferences.convertToManaged ? 'text-gray-400' : 'text-gray-700'}`}>
                    Run converted servers in container
                  </span>
                </label>
                <p className={`text-sm ml-6 mt-1 ${!importPreferences.convertToManaged ? 'text-gray-400' : 'text-gray-500'}`}>
                  Run converted managed servers in containers when possible
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowImportDialog(false)}
                disabled={isImporting}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleImportConfirm}
                disabled={isImporting}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isImporting ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 