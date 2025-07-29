import { ServerCatalogEntry, ServerCatalogFilters, ServerCatalogSearchResult } from '@/types/server-catalog';
import { logger } from '@/lib/logging/server';

export interface ServerCatalogService {
    getAllServers(): Promise<ServerCatalogEntry[]>;
    getServerByName(name: string): Promise<ServerCatalogEntry | null>;
    getServerById(id: string): Promise<ServerCatalogEntry | null>;
    searchServers(filters: ServerCatalogFilters): Promise<ServerCatalogSearchResult>;
    getServersByTags(tags: string[]): Promise<ServerCatalogEntry[]>;
    getServersByTransport(transport: 'stdio' | 'sse' | 'streamable'): Promise<ServerCatalogEntry[]>;
    getPopularServers(limit?: number): Promise<ServerCatalogEntry[]>;
    getRecentlyUpdatedServers(limit?: number): Promise<ServerCatalogEntry[]>;
    getAllTags(): Promise<string[]>;
    reloadCatalog(): Promise<void>;
}

// We're going to load the server lists from our static site
const CATALOG_BASE_URL = 'https://teamsparkai.github.io/ToolCatalog';
const CATALOG_SERVERS_JSON_URL = `${CATALOG_BASE_URL}/servers-local.json`;

export class ServerCatalogServiceImpl implements ServerCatalogService {
    private servers: ServerCatalogEntry[] = [];
    private lastLoadTime: number = 0;
    private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    private loadingPromise: Promise<void> | null = null; // Add loading promise to prevent concurrent loads

    constructor() {
    }

    private async loadCatalogIfNeeded(): Promise<void> {
        const now = Date.now();
        if (this.servers.length === 0 || (now - this.lastLoadTime) > this.CACHE_DURATION) {
            // If already loading, wait for the existing load to complete
            if (this.loadingPromise) {
                await this.loadingPromise;
                return;
            }
            
            // Start loading and store the promise
            this.loadingPromise = this.loadCatalog();
            try {
                await this.loadingPromise;
            } finally {
                this.loadingPromise = null;
            }
        }
    }

    private async loadCatalog(): Promise<void> {
        logger.debug('Loading server catalog from', CATALOG_SERVERS_JSON_URL);
        try {
            const response = await fetch(CATALOG_SERVERS_JSON_URL);
            const data = await response.json();            
            this.servers = data;
            for (const server of this.servers) {
                // Udpate the server icons to point to the remote location
                server.icon = server.icon ? `${CATALOG_BASE_URL}${server.icon}` : null;
            }
            logger.debug('Loaded', this.servers.length, 'servers');
            this.lastLoadTime = Date.now();
        } catch (error) {
            logger.error('Error loading server catalog:', error);
            this.servers = [];
            throw new Error('Failed to load server catalog');
        }
    }

    async getAllServers(): Promise<ServerCatalogEntry[]> {
        await this.loadCatalogIfNeeded();
        return [...this.servers];
    }

    async getServerByName(name: string): Promise<ServerCatalogEntry | null> {
        await this.loadCatalogIfNeeded();
        return this.servers.find(server => server.name === name) || null;
    }

    async getServerById(id: string): Promise<ServerCatalogEntry | null> {
        await this.loadCatalogIfNeeded();
        return this.servers.find(server => server.id === id) || null;
    }

    async searchServers(filters: ServerCatalogFilters): Promise<ServerCatalogSearchResult> {
        await this.loadCatalogIfNeeded();
        
        let filteredServers = [...this.servers];

        // Apply search filter
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filteredServers = filteredServers.filter(server => 
                server.name.toLowerCase().includes(searchTerm) ||
                server.description.toLowerCase().includes(searchTerm) ||
                server.tags.some(tag => tag.toLowerCase().includes(searchTerm))
            );
        }

        // Apply tags filter
        if (filters.tags && filters.tags.length > 0) {
            filteredServers = filteredServers.filter(server =>
                filters.tags!.some(tag => server.tags.includes(tag))
            );
        }

        // Apply transport filter
        if (filters.transport) {
            filteredServers = filteredServers.filter(
                server => server.serverConfig && server.serverConfig.type === filters.transport
            );
        }

        return {
            servers: filteredServers,
            total: this.servers.length,
            filtered: filteredServers.length
        };
    }

    async getServersByTags(tags: string[]): Promise<ServerCatalogEntry[]> {
        await this.loadCatalogIfNeeded();
        return this.servers.filter(server =>
            tags.some(tag => server.tags.includes(tag))
        );
    }

    async getServersByTransport(transport: 'stdio' | 'sse' | 'streamable'): Promise<ServerCatalogEntry[]> {
        await this.loadCatalogIfNeeded();
        return this.servers.filter(server => server.serverConfig && server.serverConfig.type === transport);
    }

    async getPopularServers(limit: number = 10): Promise<ServerCatalogEntry[]> {
        await this.loadCatalogIfNeeded();
        return this.servers
            .sort((a, b) => (b.repository.stars || 0) - (a.repository.stars || 0))
            .slice(0, limit);
    }

    async getRecentlyUpdatedServers(limit: number = 10): Promise<ServerCatalogEntry[]> {
        await this.loadCatalogIfNeeded();
        return this.servers
            .sort((a, b) => {
                const aDate = a.repository.lastUpdated ? new Date(a.repository.lastUpdated).getTime() : 0;
                const bDate = b.repository.lastUpdated ? new Date(b.repository.lastUpdated).getTime() : 0;
                return bDate - aDate;
            })
            .slice(0, limit);
    }

    async getAllTags(): Promise<string[]> {
        await this.loadCatalogIfNeeded();
        const tagSet = new Set<string>();
        this.servers.forEach(server => {
            server.tags.forEach(tag => tagSet.add(tag));
        });
        return Array.from(tagSet).sort();
    }

    async reloadCatalog(): Promise<void> {
        this.lastLoadTime = 0; // Force reload
        await this.loadCatalog();
    }
}

// Use a global variable to ensure singleton persistence across module contexts
declare global {
    var serverCatalogServiceInstance: ServerCatalogService | null;
}
  
if (!global.serverCatalogServiceInstance) {
    global.serverCatalogServiceInstance = null;
}

export function getServerCatalogService(): ServerCatalogService {
    if (!global.serverCatalogServiceInstance) {
        logger.debug('[getServerCatalogService] Creating new singleton instance');
        global.serverCatalogServiceInstance = new ServerCatalogServiceImpl();
    } else {
        logger.debug('[getServerCatalogService] Returning existing singleton instance');
    }
    return global.serverCatalogServiceInstance!;
} 