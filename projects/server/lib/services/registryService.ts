import { ServerJSON, ServerListResponse, ServerListResponseRaw } from '@/types/mcp-registry';
import { McpRegistryFilters, McpRegistrySearchResult, ListServersParams } from '@/types/registry-api';
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
        
        logger.info(`[loadRegistryIfNeeded] CALLED - servers.length: ${this.servers.length}`);
        
        // Check if we need to reload based on file timestamp
        const needsReload = await this.shouldReloadRegistry();
        
        logger.info(`[loadRegistryIfNeeded] needsReload: ${needsReload}`);
        
        if (this.servers.length === 0 || needsReload) {
            // If already loading, wait for the existing load to complete
            if (this.loadingPromise) {
                logger.info(`[loadRegistryIfNeeded] Already loading, waiting...`);
                await this.loadingPromise;
                return;
            }
            
            logger.info(`[loadRegistryIfNeeded] Starting load...`);
            // Start loading and store the promise
            this.loadingPromise = this.loadRegistry();
            try {
                await this.loadingPromise;
                logger.info(`[loadRegistryIfNeeded] Load completed, servers.length: ${this.servers.length}`);
            } finally {
                this.loadingPromise = null;
            }
        } else {
            logger.info(`[loadRegistryIfNeeded] Using cached data, servers.length: ${this.servers.length}`);
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
        logger.info('[loadRegistry] STARTING - trying to load from file first...');
        
        // Try to load from local file first
        if (await this.loadFromFile()) {
            logger.info(`[loadRegistry] Loaded ${this.servers.length} servers from local file`);
            this.lastLoadTime = Date.now();
            return;
        }

        // Fallback to remote fetch
        logger.info(`[loadRegistry] No local file, fetching from ${MCP_REGISTRY_API_URL}`);
        try {
            // Fetch all servers from the registry API (unwrapping happens in fetchAllServers)
            const result = await this.fetchAllServers();
            logger.info(`[loadRegistry] fetchAllServers returned ${result.servers.length} servers`);
            
            this.servers = result.servers;
            this.metadata = result.metadata;
            
            logger.info(`[loadRegistry] Loaded ${this.servers.length} servers from MCP registry`);
            this.lastLoadTime = Date.now();
            
            // Generate the local registry file
            logger.info('[loadRegistry] Generating local registry file...');
            await this.generateRegistryFile();
            logger.info('[loadRegistry] Local registry file generated');
        } catch (error) {
            logger.error('[loadRegistry] ERROR loading server registry:', error);
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

    private async fetchAllServers(): Promise<{ servers: ServerJSON[], metadata: { count: number; nextCursor?: string } }> {
        logger.info('[fetchAllServers] STARTING fetch from MCP Registry API');
        const allServers: ServerJSON[] = [];
        let cursor: string | undefined = undefined;
        const limit = 100; // Maximum per page
        let totalCount = 0;

        while (true) {
            const params = new URLSearchParams();
            if (cursor) params.set('cursor', cursor);
            params.set('limit', limit.toString());
            
            const url = `${MCP_REGISTRY_API_URL}?${params.toString()}`;
            logger.info(`[fetchAllServers] Fetching from ${url}`);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch registry: ${response.status} ${response.statusText}`);
            }

            const data: ServerListResponseRaw = await response.json();
            logger.info(`[fetchAllServers] Got ${data.servers?.length || 0} servers from API`);
            
            if (data.servers) {
                // Unwrap the nested server structure
                logger.info(`[fetchAllServers] Before unwrap - first server has 'server' key: ${!!data.servers[0]?.server}`);
                const unwrappedServers = data.servers.map(item => ({
                    ...item.server,
                    _meta: item._meta
                }));
                logger.info(`[fetchAllServers] After unwrap - first server name: ${unwrappedServers[0]?.name || 'undefined'}`);
                allServers.push(...unwrappedServers);
            }
            
            totalCount = data.metadata?.count || 0;
            
            logger.info(`[fetchAllServers] Metadata count: ${totalCount}, nextCursor: ${data.metadata?.nextCursor || 'none'}`);
            logger.info(`[fetchAllServers] Total collected so far: ${allServers.length}`);
            
            // Check if we have more pages
            if (!data.metadata?.nextCursor || data.servers?.length === 0) {
                logger.info(`[fetchAllServers] No more pages. Breaking. nextCursor: ${data.metadata?.nextCursor}, servers.length: ${data.servers?.length}`);
                break;
            }
            
            cursor = data.metadata.nextCursor;
            logger.info(`[fetchAllServers] Continuing to next page with cursor: ${cursor}`);
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
        logger.info('[searchServers] CALLED with filters:', JSON.stringify(filters));
        
        await this.loadRegistryIfNeeded();
        
        logger.info(`[searchServers] After load - servers length: ${this.servers.length}, first server name: ${this.servers[0]?.name || 'undefined'}`);
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
