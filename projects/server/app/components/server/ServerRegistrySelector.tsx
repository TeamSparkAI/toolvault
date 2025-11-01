import React, { useState, useEffect, useCallback } from 'react';
import { ServerJSON } from '@/types/mcp-registry';

interface ServerRegistrySelectorProps {
  onSelectRegistryServer: (server: ServerJSON) => void;
}

export function ServerRegistrySelector({
  onSelectRegistryServer
}: ServerRegistrySelectorProps) {
  const [servers, setServers] = useState<ServerJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>(['Latest']);

  useEffect(() => {
    loadServerRegistry();
  }, []);

  const loadServerRegistry = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/server-registry');
      if (!response.ok) {
        throw new Error('Failed to load server registry');
      }
      const data = await response.json();
      if (data.servers) {
        setServers(data.servers);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load server registry');
    } finally {
      setLoading(false);
    }
  };

  const filteredServers = servers.filter(server => {
    const search = searchTerm.toLowerCase();
    const name = (server.name || '').toLowerCase();
    const description = (server.description || '').toLowerCase();

    const nameMatch = name.includes(search);
    const descMatch = description.includes(search);

    const matchesSearch = !searchTerm || nameMatch || descMatch;
    
    // Filter logic for Latest/Hosted/Installable
    let matchesFilters = true;
    if (selectedFilters.length > 0) {
      matchesFilters = selectedFilters.every(filter => {
        if (filter === 'Latest') {
          return server._meta?.['io.modelcontextprotocol.registry/official']?.isLatest === true;
        } else if (filter === 'Hosted') {
          return server.remotes && server.remotes.length > 0;
        } else if (filter === 'Installable') {
          return server.packages && server.packages.length > 0;
        }
        return false;
      });
    }
    
    return matchesSearch && matchesFilters;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const getRemotesSummary = (server: ServerJSON): string | null => {
    if (!server.remotes || server.remotes.length === 0) {
      return null;
    }
    const remoteTypes = server.remotes.map(remote => remote.type).join(', ');
    return remoteTypes;
  };

  const getPackagesSummary = (server: ServerJSON): string | null => {
    if (!server.packages || server.packages.length === 0) {
      return null;
    }
    const packageInfos = server.packages.map(pkg => {
      return `${pkg.registryType}`;
    }).join(', ');
    return packageInfos;
  };

  const isOfficial = (server: ServerJSON) => {
    return server._meta?.['io.modelcontextprotocol.registry/official']?.isLatest;
  };

  const handleFilterToggle = (filter: string) => {
    setSelectedFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading server registry...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MCP Server Registry</h1>
            <p className="text-gray-600 mt-1">
              Browse and install servers from the official MCP Registry
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Servers
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Filter Buttons and Count */}
          <div className="flex justify-between items-center">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleFilterToggle('Hosted')}
                className={`px-3 py-1 text-sm rounded-full border ${
                  selectedFilters.includes('Hosted')
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Hosted
              </button>
              <button
                onClick={() => handleFilterToggle('Installable')}
                className={`px-3 py-1 text-sm rounded-full border ${
                  selectedFilters.includes('Installable')
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Installable
              </button>
              <button
                onClick={() => handleFilterToggle('Latest')}
                className={`px-3 py-1 text-sm rounded-full border ${
                  selectedFilters.includes('Latest')
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Latest
              </button>
              {selectedFilters.length > 0 && (
                <button
                  onClick={() => setSelectedFilters([])}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear filters
                </button>
              )}
            </div>
            <div className="text-sm text-gray-600">
              {searchTerm || selectedFilters.length > 0 
                ? `${filteredServers.length} matching servers`
                : `${servers.length} servers`
              }
            </div>
          </div>
        </div>
      </div>

      {/* Server Grid */}
      <div className="bg-white rounded-lg border">
        <div className="p-6">
          {filteredServers.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500">
                {searchTerm ? 'No servers found matching your search.' : 'No servers available.'}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServers.map((server) => {
                const remotesSummary = getRemotesSummary(server);
                const packagesSummary = getPackagesSummary(server);

                return (
                  <div
                    key={`${server.name}-${server.version}`}
                    className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => onSelectRegistryServer(server)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <img src="/mcp_black.png" alt="MCP Server" className="w-8 h-8" />
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                      {server.name}
                    </h3>
                    
                    <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                      {server.description}
                    </p>
                    
                    <div className="space-y-2 text-xs text-gray-500">
                      <div className="flex items-center justify-between">
                        <span>Version</span>
                        <span className="font-medium">{server.version}</span>
                      </div>
                      {remotesSummary && (
                        <div className="flex items-center justify-between">
                          <span>Remotes</span>
                          <span className="font-medium">{remotesSummary}</span>
                        </div>
                      )}
                      {packagesSummary && (
                        <div className="flex items-center justify-between">
                          <span>Packages</span>
                          <span className="font-medium">{packagesSummary}</span>
                        </div>
                      )}
                      {server.status && (
                        <div className="flex items-center justify-between">
                          <span>Status</span>
                          <span className={`font-medium ${
                            server.status === 'active' ? 'text-green-600' : 
                            server.status === 'deprecated' ? 'text-yellow-600' : 
                            'text-gray-600'
                          }`}>
                            {server.status}
                          </span>
                        </div>
                      )}
                    </div>
                    
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
