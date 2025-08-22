import { McpServerConfig, ServerSecurity } from "@/lib/types/server";

export interface ServerPinningInfo {
  package: {
    registry: 'npm' | 'pypi';
    name: string;
    version: string;
  };
  mcpResponses: {
    initialize: object;  // Raw JSONRPC initialize response
    toolsList: object;   // Raw JSONRPC tools/list response
  };
  pinnedAt: string;     // ISO timestamp
  pinnedBy?: string;    // Optional: who/what pinned it
}

export interface ServerData {
    serverId: number;
    token: string;
    name: string;
    description?: string;
    config: McpServerConfig;
    enabled: boolean;
    security?: ServerSecurity;
    serverCatalogId?: string;
    serverCatalogIcon?: string;
    pinningInfo?: ServerPinningInfo;  // New structured field
    createdAt: string;
    updatedAt: string;
}

export interface ServerFilter {
    name?: string;
    enabled?: boolean;
    managed?: boolean;
    serverCatalogId?: string;
}

export interface ServerPagination {
    limit: number;
    cursor?: number;
    sort: 'asc' | 'desc';
}

export interface ServerListResult {
    servers: ServerData[];
    pagination: {
        total: number;
        remaining: number;
        hasMore: boolean;
        nextCursor: number | null;
        limit: number;
        sort: 'asc' | 'desc';
    };
}