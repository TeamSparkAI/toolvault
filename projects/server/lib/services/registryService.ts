import { ServerJSON, ServerListResponse, McpRegistryFilters, McpRegistrySearchResult, ListServersParams } from '@/types/mcp-registry';
import { logger } from '@/lib/logging/server';
import fs from 'fs';
import path from 'path';
import { getAppDataPath } from '../../../shared/utils/paths';

export interface RegistryService {
    getAllServers(): Promise<ServerJSON[]>;
    getServerById(id: string): Promise<ServerJSON | null>;
    searchServers(filters: McpRegistryFilters): Promise<McpRegistrySearchResult>;
    getLatestServers(limit?: number): Promise<ServerJSON[]>;
    reloadRegistry(): Promise<void>;
    generateRegistryFile(): Promise<void>;
    getRegistryFilePath(): string;
}

// Official MCP Registry API endpoint
const MCP_REGISTRY_BASE_URL = 'https://registry.modelcontextprotocol.io';
const MCP_REGISTRY_API_URL = `${MCP_REGISTRY_BASE_URL}/v0/servers`;

// Local registry file path
const REGISTRY_FILE_PATH = path.join(getAppDataPath(), 'server-registry.json');

export class RegistryServiceImpl implements RegistryService {
    private servers: ServerJSON[] = [];
    private metadata: { count: number; next_cursor?: string } | null = null;
    private lastLoadTime: number = 0;
    private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    private loadingPromise: Promise<void> | null = null;

    constructor() {
    }

    private async loadRegistryIfNeeded(): Promise<void> {
        const now = Date.now();
        
        // Check if we need to reload based on file timestamp
        const needsReload = await this.shouldReloadRegistry();
        
        if (this.servers.length === 0 || needsReload) {
            // If already loading, wait for the existing load to complete
            if (this.loadingPromise) {
                await this.loadingPromise;
                return;
            }
            
            // Start loading and store the promise
            this.loadingPromise = this.loadRegistry();
            try {
                await this.loadingPromise;
            } finally {
                this.loadingPromise = null;
            }
        }
    }

    private async shouldReloadRegistry(): Promise<boolean> {
        try {
            // Check if file exists
            if (!fs.existsSync(REGISTRY_FILE_PATH)) {
                return true; // File doesn't exist, need to load
            }

            // Check file timestamp
            const stats = fs.statSync(REGISTRY_FILE_PATH);
            const fileAge = Date.now() - stats.mtime.getTime();
            
            return fileAge > this.CACHE_DURATION;
        } catch (error) {
            logger.debug('Error checking registry file timestamp:', error);
            return true; // On error, reload to be safe
        }
    }

    private async loadRegistry(): Promise<void> {
        // Try to load from local file first
        if (await this.loadFromFile()) {
            logger.debug('Loaded server registry from local file');
            this.lastLoadTime = Date.now();
            return;
        }

        // Fallback to remote fetch
        logger.debug('Loading server registry from', MCP_REGISTRY_API_URL);
        try {
            // Fetch all servers from the registry API
            const result = await this.fetchAllServers();
            this.servers = result.servers;
            this.metadata = result.metadata;
            
            logger.debug('Loaded', this.servers.length, 'servers from MCP registry');
            this.lastLoadTime = Date.now();
            
            // Generate the local registry file
            await this.generateRegistryFile();
        } catch (error) {
            logger.error('Error loading server registry:', error);
            this.servers = [];
            throw new Error('Failed to load server registry');
        }
    }

    private async loadFromFile(): Promise<boolean> {
        try {
            if (!fs.existsSync(REGISTRY_FILE_PATH)) {
                return false;
            }

            const fileContent = fs.readFileSync(REGISTRY_FILE_PATH, 'utf8');
            const data: ServerListResponse = JSON.parse(fileContent);
            
            this.servers = data.servers || [];
            this.metadata = data.metadata || null;
            
            return true;
        } catch (error) {
            logger.debug('Error loading registry from file:', error);
            return false;
        }
    }

    private async fetchAllServers(): Promise<{ servers: ServerJSON[], metadata: { count: number; next_cursor?: string } }> {
        const allServers: ServerJSON[] = [];
        let cursor: string | undefined = undefined;
        const limit = 100; // Maximum per page
        let totalCount = 0;

        while (true) {
            const params = new URLSearchParams();
            if (cursor) params.set('cursor', cursor);
            params.set('limit', limit.toString());
            
            const url = `${MCP_REGISTRY_API_URL}?${params.toString()}`;
            logger.debug(`Fetching registry from ${url}`);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch registry: ${response.status} ${response.statusText}`);
            }

            const data: ServerListResponse = await response.json();
            
            if (data.servers) {
                allServers.push(...data.servers);
            }
            
            totalCount = data.metadata?.count || 0;
            
            // Check if we have more pages
            if (!data.metadata?.next_cursor || data.servers?.length === 0) {
                break;
            }
            
            cursor = data.metadata.next_cursor;
            logger.debug(`Fetched ${data.servers?.length || 0} servers (total so far: ${allServers.length}, total available: ${totalCount})`);
        }

        return {
            servers: allServers,
            metadata: { count: totalCount }
        };
    }

    async generateRegistryFile(): Promise<void> {
        try {
            // Ensure app data directory exists
            const appDataPath = getAppDataPath();
            if (!fs.existsSync(appDataPath)) {
                fs.mkdirSync(appDataPath, { recursive: true });
            }

            const registryData: ServerListResponse = {
                servers: this.servers,
                metadata: this.metadata || { count: this.servers.length }
            };

            const jsonContent = JSON.stringify(registryData, null, 2);
            fs.writeFileSync(REGISTRY_FILE_PATH, jsonContent, 'utf8');
            
            logger.debug(`Generated server-registry.json with ${this.servers.length} servers at ${REGISTRY_FILE_PATH}`);
        } catch (error) {
            logger.error('Error generating registry file:', error);
            throw new Error('Failed to generate server-registry.json');
        }
    }

    async getAllServers(): Promise<ServerJSON[]> {
        await this.loadRegistryIfNeeded();
        return [...this.servers];
    }

    async getServerById(id: string): Promise<ServerJSON | null> {
        await this.loadRegistryIfNeeded();
        // Note: The MCP registry doesn't expose server IDs in the list response
        // This would need to be implemented differently, perhaps by fetching individual servers
        return null;
    }

    async searchServers(filters: McpRegistryFilters): Promise<McpRegistrySearchResult> {
        await this.loadRegistryIfNeeded();
        
        let filteredServers = [...this.servers];

        // Apply search filter (name substring match)
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filteredServers = filteredServers.filter(server => 
                server.name.toLowerCase().includes(searchTerm) ||
                server.description.toLowerCase().includes(searchTerm)
            );
        }

        // Apply version filter
        if (filters.version) {
            if (filters.version === 'latest') {
                // Filter to only show servers marked as latest in the registry
                filteredServers = filteredServers.filter(server =>
                    server._meta?.['io.modelcontextprotocol.registry/official']?.isLatest === true
                );
            } else {
                filteredServers = filteredServers.filter(server =>
                    server.version === filters.version
                );
            }
        }

        // Apply updated_since filter
        if (filters.updated_since) {
            const sinceDate = new Date(filters.updated_since);
            filteredServers = filteredServers.filter(server => {
                // Check if server has registry metadata with published date
                const publishedAt = server._meta?.['io.modelcontextprotocol.registry/official']?.publishedAt;
                if (publishedAt) {
                    const serverDate = new Date(publishedAt);
                    return serverDate >= sinceDate;
                }
                // If no published date, include the server (don't filter it out)
                return true;
            });
        }

        return {
            servers: filteredServers,
            metadata: {
                count: this.metadata?.count || this.servers.length,
                filtered: filteredServers.length
            }
        };
    }

    async getLatestServers(limit: number = 10): Promise<ServerJSON[]> {
        await this.loadRegistryIfNeeded();
        return this.servers.slice(0, limit);
    }

    async reloadRegistry(): Promise<void> {
        this.lastLoadTime = 0; // Force reload
        await this.loadRegistry();
    }

    getRegistryFilePath(): string {
        return REGISTRY_FILE_PATH;
    }
}

// Use a global variable to ensure singleton persistence across module contexts
declare global {
    var registryServiceInstance: RegistryService | null;
}
  
if (!global.registryServiceInstance) {
    global.registryServiceInstance = null;
}

export function getRegistryService(): RegistryService {
    if (!global.registryServiceInstance) {
        logger.debug('[getRegistryService] Creating new singleton instance');
        global.registryServiceInstance = new RegistryServiceImpl();
    } else {
        logger.debug('[getRegistryService] Returning existing singleton instance');
    }
    return global.registryServiceInstance!;
}
