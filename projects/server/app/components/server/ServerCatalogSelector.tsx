import React, { useState, useEffect } from 'react';
import { ServerCatalogEntry } from '@/types/server-catalog';
import { McpServerConfig } from '@/lib/types/server';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { getServerCatalogIconUrl } from '@/lib/utils/githubImageUrl';

interface ServerCatalogSelectorProps {
  onSelectCustom: () => void;
  onSelectCatalogServer: (server: ServerCatalogEntry) => void;
  onCancel: () => void;
}

export function ServerCatalogSelector({
  onSelectCustom,
  onSelectCatalogServer,
  onCancel
}: ServerCatalogSelectorProps) {
  const [servers, setServers] = useState<ServerCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    loadServerCatalog();
  }, []);

  const loadServerCatalog = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/server-catalog');
      if (!response.ok) {
        throw new Error('Failed to load server catalog');
      }
      const data = await response.json();
      const serversResponse = new JsonResponseFetch<ServerCatalogEntry[]>(data, 'servers');
      if (!serversResponse.isSuccess()) {
        throw new Error(serversResponse.message || 'Failed to load server catalog');
      }
      setServers(serversResponse.payload);
      
      // Extract unique tags
      const tagSet = new Set<string>();
      serversResponse.payload.forEach((server: ServerCatalogEntry) => {
        server.tags.forEach(tag => tagSet.add(tag));
      });
      setAvailableTags(Array.from(tagSet).sort());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load server catalog');
    } finally {
      setLoading(false);
    }
  };

  const filteredServers = servers.filter(server => {
    const search = searchTerm.toLowerCase();
    const name = (server.name || '').toLowerCase();
    const description = (server.description || '').toLowerCase();
    const tags = (server.tags || []).map(tag => tag.toLowerCase());

    const nameMatch = name.includes(search);
    const descMatch = description.includes(search);
    const tagMatch = tags.some(tag => tag.includes(search));

    /*
    if (searchTerm && (nameMatch || descMatch || tagMatch)) {
      log.debug('MATCH:', {
        name: server.name,
        description: server.description,
        tags: server.tags,
        nameMatch,
        descMatch,
        tagMatch
      });
    }
    */

    const matchesSearch = !searchTerm || nameMatch || descMatch || tagMatch;
    const matchesTags = selectedTags.length === 0 ||
      selectedTags.some(tag => server.tags.includes(tag));
    return matchesSearch && matchesTags;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const convertCatalogEntryToServerConfig = (entry: ServerCatalogEntry): McpServerConfig | undefined => {
    return entry.serverConfig;
  };

  const getServerConfigSummary = (server: ServerCatalogEntry): string | null => {
    if (!server.serverConfig) {
      return null;
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
        <div className="text-gray-500">Loading server catalog...</div>
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
      {/* Search and Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search servers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        {/* Tags Filter and Count */}
        <div className="flex justify-between items-center">
          <div className="flex flex-wrap gap-2">
            {availableTags.slice(0, 10).map(tag => (
              <button
                key={tag}
                onClick={() => handleTagToggle(tag)}
                className={`px-3 py-1 text-sm rounded-full border ${
                  selectedTags.includes(tag)
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tag}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear tag filters
              </button>
            )}
          </div>
          <div className="text-sm text-gray-600">
            {searchTerm || selectedTags.length > 0 
              ? `${filteredServers.length} matching servers`
              : `${servers.length} servers`
            }
          </div>
        </div>
      </div>

      {/* Server List */}
      <div className="bg-white rounded-lg border">
        {/* Custom Option */}
        <div
          onClick={onSelectCustom}
          className="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-gray-600 text-lg">+</span>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Custom Server</h3>
                <p className="text-gray-600">Create a server with custom configuration</p>
              </div>
            </div>
            <div className="text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Catalog Servers */}
        {filteredServers.map((server) => {
          const isVerified = server.tags.includes('official') || 
            (server.tags.includes('reference') && !server.tags.includes('archived'));
          
          return (
            <div
              key={server.id}
              onClick={() => onSelectCatalogServer(server)}
              className="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start space-x-3">
                  <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                    <img src={getServerCatalogIconUrl(server)} alt={server.name} className="w-10 h-10" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-medium text-gray-900">{server.name}</h3>
                      {isVerified && (
                        <span className="ml-1 inline-flex items-center justify-center bg-blue-500 rounded-full p-1">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                      {getServerConfigSummary(server) && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                          {getServerConfigSummary(server)}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                      {server.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {server.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {server.tags.length > 3 && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                          +{server.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-gray-400">
                  <div className="text-right">
                    {server.repository.stars && (
                      <div className="text-sm">⭐ {server.repository.stars.toLocaleString()}</div>
                    )}
                    {server.repository.lastUpdated && (
                      <div className="text-xs text-gray-500">
                        {new Date(server.repository.lastUpdated).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          );
        })}

        {filteredServers.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No servers found matching your criteria
          </div>
        )}
      </div>
    </div>
  );
} 