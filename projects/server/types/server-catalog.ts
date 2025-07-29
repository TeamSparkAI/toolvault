import type { McpServerConfig } from '@/lib/types/server';

export interface ServerRepository {
  url: string;
  source: 'github' | 'gitlab' | 'other';
  stars?: number;
  lastUpdated?: string;
}

export interface ServerCatalogEntry {
  id: string;
  icon: string | null;
  name: string;
  description: string;
  repository: ServerRepository;
  tags: string[];
  serverName?: string;
  serverConfig?: McpServerConfig;
}

export interface ServerCatalog {
  servers: ServerCatalogEntry[];
}

// Helper types for filtering and searching
export interface ServerCatalogFilters {
  search?: string;
  tags?: string[];
  transport?: 'stdio' | 'sse' | 'streamable';
}

export interface ServerCatalogSearchResult {
  servers: ServerCatalogEntry[];
  total: number;
  filtered: number;
} 