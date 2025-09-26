// Types for our internal registry API endpoints
// These types are specific to our ToolVault registry implementation

import { ServerJSON } from './mcp-registry';

// Query parameters for the list-servers endpoint
export interface ListServersParams {
  cursor?: string; // UUID pagination cursor
  limit?: number; // Number of items per page (1-100, default: 30)
  updated_since?: string; // RFC3339 datetime filter
  search?: string; // Search servers by name (substring match)
  version?: string; // Filter by version ('latest' or exact version like '1.2.3')
}

// Response types for our internal API
export interface McpRegistryFilters {
  search?: string;
  version?: string;
  updated_since?: string;
  cursor?: string;
  limit?: number;
}

export interface McpRegistrySearchResult {
  servers: ServerJSON[];
  metadata: {
    next_cursor?: string;
    count?: number;
    filtered?: number; // Number of servers after filtering
  };
}
