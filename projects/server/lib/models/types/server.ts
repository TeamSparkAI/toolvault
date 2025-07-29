import { McpServerConfig, ServerSecurity } from "@/lib/types/server";

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